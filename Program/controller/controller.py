from io import BytesIO
from os import remove, mkdir
from os.path import join, isfile, getsize
from shutil import rmtree
from re import compile
from operator import itemgetter
from PIL import Image
from qrcode import make
from openpyxl import Workbook
from base64 import b64encode
from bson import ObjectId
from uuid import uuid1
from datetime import datetime, timedelta
from werkzeug.datastructures import FileStorage
from flask import request, render_template, session, redirect, abort, url_for, send_file, g
from flask.json import loads, jsonify
from flask_login import login_user, logout_user, login_required, current_user

from Program import app, mongo, login_manager, model
from Program.controller.utils import generate_captcha_text_and_image, SMTPEmail, AESCryptor
from setting import REGISTER_STATUS, REGISTER_CODES, USED_REGISTER_CODES
from setting import PERMANENT_SESSION_LIFETIME, FILE_FOLDER, DOMAIN, KEY1, KEY2


def show_msg(face, title, target_page, href, message=None, second=3):
    if message is None:
        return render_template('msg.html', face=face, title=title, target_page=target_page, href=href, second=second)
    else:
        return render_template('msg.html', face=face, title=title, target_page=target_page, href=href, msg=message,
                               second=second)


def data_and_condition_handler(obj, survey_id=None):
    if isinstance(obj, dict):
        for (k, v) in obj.items():
            obj[k] = data_and_condition_handler(v, survey_id)
    elif isinstance(obj, list):
        for k, v in enumerate(obj):
            obj[k] = data_and_condition_handler(v, survey_id)
    elif isinstance(obj, ObjectId):
        obj = ObjectId(obj)
    elif isinstance(obj, str):
        if not obj.startswith(('date_', 'regex_')):
            return obj
        s = obj.split('_')
        if s[0] == 'date':
            d = s[1].split('-')
            obj = datetime(int(d[0]), int(d[1]), int(d[2]))
        elif s[0] == 'regex':
            obj = compile(s[1])
    elif isinstance(obj, FileStorage):
        if not survey_id or not ObjectId.is_valid(survey_id):
            raise ValueError('invalid survey_id!')
        filename = '{}_{}_{}'.format(uuid1(), obj.name, obj.filename)
        file_path = join(FILE_FOLDER, survey_id, filename)
        obj.save(file_path)
        if obj.mimetype.startswith('image/') and obj.mimetype != 'image/gif':
            img = Image.open(file_path)
            if getsize(file_path) > 102400:
                img.thumbnail((img.width / 4, img.height / 4))
            out = BytesIO()
            img.save(out, 'jpeg', quality=25)
            out.seek(0)
            data_url = b64encode(out.read()).decode()
            obj = 'img|{}|{}'.format(filename, data_url)
        else:
            obj = 'file|{}'.format(filename)
    return obj


def answer_wrapper(answer):
    answer['_id'] = str(answer.get('_id'))
    for (k, v) in answer.items():
        if isinstance(v, datetime):
            answer[k] = v.strftime('%Y-%m-%d')


def make_xlsx(survey_id, cursor):
    questions = []
    try:
        survey = mongo.db.surveys.find_one({'_id': ObjectId(survey_id)})
        if not survey:
            return jsonify(code=0, msg='未查询到该问卷。')
        survey_name = survey.get('title')
        for question in mongo.db.questions.find({'survey_id': survey_id}):
            questions.append(question)
    except Exception as e:
        print(e)
        return jsonify(code=0, msg=str(e))
    if not questions:
        return jsonify(code=0, msg='该问卷尚未添加问题。')
    questions.sort(key=itemgetter('num'))  # 将题目按题号排序
    first_row = ['答卷ID', '提交时间', '来源']
    keys = ['_id', 'submit_time', 'source']
    for question in questions:
        if question.get('is_required'):
            star = '*'
        else:
            star = ''
        if question.get('type') in ('单项选择', '下拉单选', '多级下拉', '单项填空', '日期', '文件'):
            first_row.append('{}.{}{}'.format(int(question.get('num')), question.get('title'), star))
            keys.append('{}'.format(int(question.get('num'))))
        elif question.get('type') == '多项填空':
            regex = compile('_+')
            title = question.get('title')
            blank_index = 1
            for index, text in enumerate(title):
                if regex.match(text):
                    try:
                        first_row.append('{}_{}.{}{}'.format(int(question.get('num')), blank_index,
                                                             title[index - 1], star))
                        keys.append('{}_{}'.format(int(question.get('num')), blank_index))
                    except IndexError:
                        pass
                    blank_index += 1
        elif question.get('type') == '矩阵单选':
            for index, title in enumerate(question.get('titles')):
                first_row.append('{}_{}.{}{}'.format(int(question.get('num')), index + 1, title, star))
                keys.append('{}_{}'.format(int(question.get('num')), index + 1))
    wb = Workbook()
    ws = wb.active
    ws.append(first_row)
    rows = 0
    for answer in cursor:
        row = []
        for key in keys:
            value = answer.get(key)
            if isinstance(value, ObjectId):
                value = str(value)
            elif isinstance(value, datetime):
                value = value.strftime('%Y-%m-%d')
            elif isinstance(value, str) and value.startswith(('img|', 'file|')):
                # 调用Excel内部的超链接函数
                value = '=Hyperlink("{}/files?filename={}&survey_id={}", "点击下载")'.format(DOMAIN,
                                                                                         value.split('|')[1], survey_id)
            row.append(value)
        ws.append(row)
        rows += 1
    now = datetime.now()
    filename = '{}_{}_{}_{}.xlsx'.format(now.strftime('%Y%m%d'), now.strftime('%H%M%S'), survey_name, rows)
    out = BytesIO()
    wb.save(out)
    out.seek(0)
    return send_file(out, as_attachment=True, attachment_filename=filename)


def is_safe_url(url):
    # target_url = request.host_url + url[1:]
    # map_adapter = app.url_map.bind_to_environ()
    # print(map_adapter.match(url))
    if url.startswith(('/survey', '/summary', '/files')):
        return True
    return False


def is_overdue(token, key=KEY1):
    """
    验证令牌是否过期。
    :param token: 令牌。
    :param key: 解密令牌的密匙。
    :return: 过期返回True，否则返回False。
    """
    if not token:
        return True
    token = AESCryptor(key).decrypt(token.replace(' ', '+')).split('-')
    if len(token) not in (3, 4):
        return True
    try:
        end_time = datetime(int(token[0]), int(token[1]), int(token[2])) if 3 == len(token) else \
            datetime(int(token[0]), int(token[1]), int(token[2]), int(token[3]))
    except ValueError:
        return True
    if end_time < datetime.now():
        return True
    return False


@app.before_request
def referrer_and_ua_check():
    g.referrer = '' if request.referrer is None else request.referrer
    ua = request.user_agent
    if not ua:
        return jsonify(code=0)


@login_manager.user_loader
def load_user(user_id):
    user_info = mongo.db.users.find_one({'_id': ObjectId(user_id)})
    return model.User(user_info.get('_id'), user_info.get('name'), user_info.get('pwd'), user_info.get('email'),
                      user_info.get('jurisdiction'))


@app.errorhandler(404)
def page_404_handler(er):
    return show_msg('(╭☞•́ω•̀)╭☞', '404', '主页', '/', '此页面正在建设中……')


@app.route('/files')
# @login_required
def file_handler():
    filename = request.args.get('filename')
    survey_id = request.args.get('survey_id')
    if not filename or not survey_id or not ObjectId.is_valid(survey_id):
        return jsonify(code=0, msg='参数格式错误。')
    file_path = join(FILE_FOLDER, survey_id, filename)
    if not isfile(file_path):
        return jsonify(code=0, msg='文件不存在。')
    return send_file(file_path, as_attachment=True,
                     attachment_filename=filename[filename.find('_', filename.find('_') + 1) + 1:])


@app.route('/captcha')
def captcha_handler():
    last_request_time = session.get('captcha_time')
    now = datetime.now()
    if last_request_time and (now - last_request_time).seconds < 2:
        return jsonify(code=0, msg='请求频率过快。')
    text, data_url = generate_captcha_text_and_image()
    session['captcha'] = AESCryptor(KEY1).encrypt(text)
    session['captcha_time'] = now
    return jsonify(code=1, data=data_url)


@app.route('/users', methods=('POST', ))
def register_handler():
    submit_captcha = request.form.get('captcha')
    real_captcha = AESCryptor(KEY1).decrypt(session.get('captcha'))
    if not real_captcha or not submit_captcha or real_captcha.lower() != submit_captcha.lower():
        return jsonify(code=0, msg='验证码错误。')
    r_code = request.form.get('r_code')
    if r_code not in REGISTER_CODES and r_code in USED_REGISTER_CODES:
        return jsonify(code=0, msg='注册码已被使用。')
    elif r_code not in REGISTER_CODES:
        return jsonify(code=0, msg='注册码错误。')
    REGISTER_CODES.remove(r_code)
    USED_REGISTER_CODES.append(r_code)
    username = request.form.get('name')
    password = request.form.get('pwd')
    email = request.form.get('email')
    if not username or not password or not email:
        return jsonify(code=0, msg='参数格式错误。')
    try:
        is_registered = mongo.db.users.count_documents({'name': username})
        if is_registered:
            return jsonify(code=0, msg='用户名已被注册。')
        result = mongo.db.users.insert_one({'name': username, 'pwd': password, 'email': email, "jurisdiction": 0})
        if result.inserted_id:
            session.pop('captcha')
            session.pop('captcha_time')
            return jsonify(code=1, msg='注册成功。')
    except Exception as e:
        return jsonify(code=0, msg=str(e))


@app.route('/users', methods=('PUT', ))
def reset_pwd_handler():
    params = request.form.get('p')
    token = request.form.get('token')
    if not params or not token:
        return jsonify(code=0, msg='参数格式错误。')
    try:
        params = loads(params)
    except Exception as e:
        return jsonify(code=0, msg=str(e))
    text = AESCryptor(KEY2).decrypt(token.replace(' ', '+')).split('-')
    if 7 == len(text):
        user_id = text[0]
        token = text[-1]
        if is_overdue(token, KEY2):
            return jsonify(code=0, msg='链接已失效。')
        try:
            user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        except Exception as e:
            return jsonify(code=0, msg=str(e))
        if user:
            try:
                result = mongo.db.users.update_one({'_id': ObjectId(user_id)}, {'$set': params})
            except Exception as e:
                return jsonify(code=0, msg=str(e))
            if 1 == result.matched_count:
                if 1 == result.modified_count:
                    return jsonify(code=1, msg='用户信息重置成功。')
                else:
                    return jsonify(code=1, msg='用户信息未发生变化。')
            else:
                return jsonify(code=0, msg='参数格式错误。')
        else:
            return jsonify(code=0, msg='参数格式错误。')
    else:
        return jsonify(code=0, msg='参数格式错误。')


@app.route('/reset', methods=('GET', 'POST'))
def reset_handler():
    if request.method == 'GET':
        if not g.referrer:
            return show_msg(':(', '无效链接', '主页', '/')
        token = request.args.get('_').replace(' ', '+')
        if is_overdue(token, KEY2):
            return show_msg(':(', '链接已失效', '主页', '/')
        user_id = request.args.get('k')
        if not user_id:
            return show_msg(':(', '无效链接', '主页', '/')
        cp = AESCryptor(KEY2)
        user_id = cp.decrypt(user_id.replace(' ', '+'))
        try:
            text = user_id.split('|')
            if 2 != len(text):
                return show_msg(':(', '无效链接', '主页', '/')
            if 5 != len(text[0].split('-')):
                return show_msg(':(', '无效链接', '主页', '/')
            user_id = text[1]
        except IndexError:
            return show_msg(':(', '无效链接', '主页', '/')
        try:
            user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        except Exception as e:
            return show_msg(':(', '无效链接', '主页', '/', str(e))
        if not user:
            return show_msg(':(', '无效链接', '主页', '/')
        return render_template('reset_pwd.html',
                               token=cp.encrypt('{}-{}-{}'.format(str(user.get('_id')), uuid1(), token)),
                               user_name=user.get('name'))
    real_captcha = AESCryptor(KEY1).decrypt(session.get('captcha'))
    submit_captcha = request.form.get('captcha')
    if not submit_captcha or submit_captcha.lower() != real_captcha.lower():
        return jsonify(code=0, msg='验证码错误。')
    name = request.form.get('name')
    email = request.form.get('email')
    if name:
        try:
            user = mongo.db.users.find_one({'name': name})
        except Exception as e:
            return jsonify(code=0, msg=str(e))
    elif email:
        try:
            user = mongo.db.users.find_one({'email': email})
        except Exception as e:
            return jsonify(code=0, msg=str(e))
    else:
        return jsonify(code=0, msg='参数格式错误。')
    if user:
        # 向邮箱发送重置密码链接
        cp = AESCryptor(KEY2)
        url = '{}/reset?k={}&_={}'.format(DOMAIN, cp.encrypt('{}|{}'.format(uuid1(), str(user.get('_id')))),
                                          cp.encrypt((datetime.now() + timedelta(hours=1)).strftime('%Y-%m-%d-%H')))
        email = user.get('email')
        result = SMTPEmail().send(email, '重置密码',
                                  '请点击此链接重置您的密码：{}，有效时间：1小时。'.format(url))
        if 1 == result:
            return jsonify(code=1, msg='我们向邮箱：{}发送了一封用于重置密码的邮件，请注意查收。'.format(email))
        else:
            return jsonify(code=0, msg=result)
    else:
        return jsonify(code=0, msg='未查询到该用户。')


@app.route('/', methods=('GET', 'POST'))
@app.route('/login', methods=('GET', 'POST'))
def index_handler():
    if current_user is not None and current_user.is_authenticated:
        return redirect(url_for('home_handler'))
    if request.method == 'GET':
        last_username = request.args.get('last_username')
        return render_template('login.html', last_username=last_username if last_username else '',
                               register_status=REGISTER_STATUS)
    submit_captcha = request.form.get('captcha')
    username = request.form.get('username')
    password = request.form.get('password')
    real_captcha = AESCryptor(KEY1).decrypt(session.get('captcha'))
    if not submit_captcha or not username or not password or not real_captcha:
        return jsonify(code=0, msg='参数格式错误。')
    if submit_captcha.lower() != real_captcha.lower():
        return jsonify(code=0, msg='验证码错误。')
    try:
        user_info = mongo.db.users.find_one({'name': username})
    except Exception as e:
        return jsonify(code=0, msg=str(e))
    if user_info and password == user_info.get('pwd'):
        user = model.User(user_info.get('_id'), user_info.get('name'), user_info.get('pwd'), user_info.get('email'),
                          user_info.get('jurisdiction'))
        login_user(user)
        session.permanent = True
        app.permanent_session_lifetime = PERMANENT_SESSION_LIFETIME
        next_url = request.args.get('next')
        if not next_url or not is_safe_url(next_url):
            href = '/home'
        else:
            href = next_url
        session.pop('captcha')
        session.pop('captcha_time')
        return jsonify(code=1, msg='登录成功。', href=href)
    return jsonify(code=0, msg='用户名或密码错误！')


@app.route('/logout')
@login_required
def logout_handler():
    username = current_user.username
    logout_user()
    return redirect(url_for('index_handler', last_username=username))


@app.route('/home')
@login_required
def home_handler():
    surveys = []
    try:
        for survey in mongo.db.surveys.find({'user_id': current_user.user_id}):
            survey['_id'] = str(survey.get('_id'))
            survey['time'] = survey.get('time').strftime('%Y-%m-%d')
            survey['count'] = mongo.db.answers.count_documents({'survey_id': survey.get('_id')})
            surveys.append(survey)
    except Exception as e:
        return show_msg(':(', '加载失败', '当前页', '/home', str(e))
    return render_template('home.html', surveys=surveys)


@app.route('/design')
@login_required
def design_handler():
    survey_id = request.args.get('id')
    if not ObjectId.is_valid(survey_id):
        return abort(404)
    survey = mongo.db.surveys.find_one({'_id': ObjectId(survey_id)})
    if not survey:
        return abort(404)
    if survey.get('status'):
        return show_msg(':(', '现在无法设计问卷', '主页', '/home', '该问卷正在运行中，无法进行设计操作。', 5)
    answer = mongo.db.answers.count_documents({'survey_id': str(survey.get('_id'))})
    if answer != 0:
        return show_msg(':(', '现在无法设计问卷', '主页', '/home', '该问卷仍存在答卷，无法进行设计操作。', 5)
    questions = []
    try:
        for question in mongo.db.questions.find({'survey_id': survey_id}):
            question['_id'] = str(question.get('_id'))
            questions.append(question)
    except Exception as e:
        return show_msg(':(', '加载失败', '主页', '/', '查询问卷失败：{}'.format(e))
    if questions:
        questions.sort(key=itemgetter('num'))  # 将题目按题号排序
    return render_template('design.html', survey_id=survey_id, title=survey.get('title'),
                           note=survey.get('note'), public=survey.get('public'), questions=questions)


@app.route('/design', methods=('POST', ))
@login_required
def design_post_handler():
    survey = loads(request.form.get('survey'))
    survey_id = survey.pop('_id', None)
    try:
        answer = mongo.db.answers.count_documents({'survey_id': survey_id})
    except Exception as e:
        return jsonify(code=0, msg=str(e))
    if answer != 0:
        return jsonify(code=0, msg='该问卷仍存在答卷，无法更改。')
    update_questions = loads(request.form.get('update'))
    delete_questions = loads(request.form.get('delete'))
    if not survey or not ObjectId.is_valid(survey_id):
        return jsonify(code=0, msg='参数格式错误。')
    try:
        result1 = mongo.db.surveys.update_one({'_id': ObjectId(survey_id)}, {'$set': survey})
        if result1.matched_count == 1:
            for question in update_questions:
                question_id = question.pop('_id', None)
                question.pop('new', None)
                if question_id:
                    mongo.db.questions.replace_one({'_id': ObjectId(question_id)}, question)
                else:
                    mongo.db.questions.insert_one(question)
            for question_id in delete_questions:
                mongo.db.questions.delete_one({'_id': ObjectId(question_id)})
        else:
            return jsonify(code=0, msg='问卷更新失败。')
    except Exception as e:
        return jsonify(code=0, msg=str(e))
    return jsonify(code=1, msg='问卷更新成功。')


@app.route('/preview')
@login_required
def preview_survey_handler():
    survey_id = request.args.get('id')
    if not ObjectId.is_valid(survey_id):
        return abort(404)
    try:
        survey = mongo.db.surveys.find_one({'_id': ObjectId(survey_id)})  # 查询问卷
    except Exception as e:
        return show_msg(':(', '查询失败', '主页', '/', '查询问卷失败：{}'.format(e))
    if not survey:
        return abort(404)
    if current_user.user_id != survey.get('user_id'):
        return show_msg(':(', '无法预览', '主页', '/', '这不是你的问卷。')
    survey['title'] = '{} - 预览'.format(survey.get('title'))
    questions = []
    try:
        for question in mongo.db.questions.find({'survey_id': survey_id}):
            questions.append(question)
    except Exception as e:
        return show_msg(':(', '查询失败', '主页', '/', '查询问卷失败：{}'.format(e))
    if not questions:
        return show_msg(':(', '查询失败', '主页', '/', '此问卷尚未添加问题。')
    questions.sort(key=itemgetter('num'))  # 将题目按题号排序
    return render_template('survey.html', survey=survey, questions=questions, preview=1)


@app.route('/surveys')
def surveys_handler():
    survey_id = request.args.get('id')
    if is_overdue(request.args.get('token')):
        return show_msg(':(', '二维码失效', '主页', '/', '此二维码已过期。')
    if not ObjectId.is_valid(survey_id):
        return abort(404)
    try:
        survey = mongo.db.surveys.find_one({'_id': ObjectId(survey_id)})  # 查询问卷
    except Exception as e:
        return show_msg(':(', '查询失败', '首页', '/', '查询问卷失败：{}'.format(e))
    if not survey:
        return abort(404)
    if 0 == survey.get('status'):
        return show_msg(':(', '此问卷尚未发布', '首页', '/', '敬请期待……')
    if 0 == survey.get('public'):
        if current_user is not None and not current_user.is_authenticated:
            return redirect(url_for('index_handler', next=request.full_path))
    questions = []
    try:
        for question in mongo.db.questions.find({'survey_id': survey_id}):
            questions.append(question)
    except Exception as e:
        return show_msg(':(', '查询失败', '主页', '/', '查询问卷失败：{}'.format(e))
    if not questions:
        return show_msg(':(', '查询失败', '主页', '/', '此问卷尚未添加问题。')
    questions.sort(key=itemgetter('num'))  # 将题目按题号排序
    return render_template('survey.html', survey=survey, questions=questions)


@app.route('/surveys', methods=('POST', ))
@login_required
def surveys_post_handler():
    title = request.form.get('title')
    note = request.form.get('note')
    public = request.form.get('public')
    copy_id = request.form.get('copy_id')
    if copy_id:
        if not ObjectId.is_valid(copy_id):
            return jsonify(code=0, msg='问卷ID非法。')
        try:
            survey = mongo.db.surveys.find_one({'_id': ObjectId(copy_id)})
            if not survey:
                return jsonify(code=0, msg='未查询到该问卷。')
            survey.pop('_id', None)
            survey['title'] += '_副本'
            survey['status'] = 0
            survey['time'] = datetime.now()
            survey['user_id'] = current_user.user_id
            survey_result = mongo.db.surveys.insert_one(survey)
            if not survey_result:
                return jsonify(code=0, msg='复制问卷失败。')
            new_survey_id = str(survey_result.inserted_id)
            questions = []
            for question in mongo.db.questions.find({'survey_id': copy_id}):
                question.pop('_id', None)
                question['survey_id'] = new_survey_id
                questions.append(question)
            if questions:
                mongo.db.questions.insert_many(questions)
            mkdir(join(FILE_FOLDER, new_survey_id))
            survey['_id'] = new_survey_id
            return jsonify(code=1, msg='复制问卷成功。', survey=survey)
        except Exception as e:
            return jsonify(code=0, msg=str(e))
    if not title or not public or public not in ('0', '1'):
        return jsonify(code=0, msg='参数格式错误。')
    try:
        survey = mongo.db.surveys.insert_one({'title': title, 'note': note, 'public': int(public), 'status': 0,
                                             'time': datetime.now(), 'user_id': current_user.user_id})
        survey_id = str(survey.inserted_id)
        mkdir(join(FILE_FOLDER, survey_id))
    except Exception as e:
        return jsonify(code=0, msg=str(e))
    return jsonify(code=1, msg='添加问卷成功。', survey_id=survey_id)


@app.route('/surveys', methods=('PUT', ))
@login_required
def surveys_update_handler():
    survey_id = request.args.get('id')
    if not ObjectId.is_valid(survey_id):
        return jsonify(code=0, msg='问卷ID非法。')
    try:
        survey = mongo.db.surveys.find_one({'_id': ObjectId(survey_id)})
    except Exception as e:
        return jsonify(code=0, msg=str(e))
    if not survey:
        return jsonify(code=0, msg='未查询到该问卷。')
    if current_user.user_id != survey.get('user_id'):
        return jsonify(code=0, msg='该问卷不属于当前用户，无法更改。')
    params = request.args.get('params')
    replace_doc = request.args.get('replace')
    if params:
        try:
            result = mongo.db.surveys.update_one({'_id': ObjectId(survey_id)}, {'$set': loads(params)})
        except Exception as e:
            return jsonify(code=0, msg=str(e))
        if result.modified_count:
            return jsonify(code=1, msg='更改成功。')
        else:
            return jsonify(code=0, msg='更改失败。')
    elif replace_doc:
        try:
            result = mongo.db.surveys.replace_one({'_id': ObjectId(survey_id)}, replace_doc)
        except Exception as e:
            return jsonify(code=0, msg=str(e))
        if result.modified_count:
            return jsonify(code=1, msg='更改成功。')
        else:
            return jsonify(code=0, msg='更改失败。')
    else:
        return jsonify(code=0, msg='参数格式错误。')


@app.route('/surveys', methods=('DELETE', ))
@login_required
def surveys_delete_handler():
    survey_id = request.args.get('_id')
    if not ObjectId.is_valid(survey_id):
        return jsonify(code=0, msg='问卷ID非法。')
    survey = mongo.db.surveys.find_one({'_id': ObjectId(survey_id)})
    if not survey:
        return jsonify(code=0, msg='未查询到该问卷。')
    if current_user.user_id != survey.get('user_id'):
        return jsonify(code=0, msg='该问卷不属于当前用户，无法删除。')
    try:
        result = mongo.db.surveys.delete_one({'_id': ObjectId(survey_id)})
        if result.deleted_count == 1:
            mongo.db.questions.delete_many({'survey_id': survey_id})
    except Exception as e:
        return jsonify(code=0, msg=str(e))
    rmtree(join(FILE_FOLDER, survey_id))              # 删除问卷的文件夹
    return jsonify(code=1, msg='删除问卷成功。')
    # with mongo.cx.start_session() as s:
    #     s.start_transaction()
    #     try:
    #         mongo.db.surveys.delete_one({'_id': ObjectId(survey_id)}, session=s)
    #         mongo.db.questions.delete_many({'survey_id': survey_id}, session=s)
    #     except ValueError as e:
    #         s.abort_transaction()
    #         return jsonify(code=0, msg=str(e))
    #     s.commit_transaction()
    # rmtree(join(FILE_FOLDER, survey_id))       # 删除问卷对应的文件夹
    # return jsonify(code=1, msg='删除问卷成功。')


@app.route('/answers', methods=('POST', ))
def answers_post_handler():
    if '/surveys?id=' not in g.referrer:
        return jsonify(code=0, msg='请通过正常渠道调用本API！')
    try:
        token = g.referrer[g.referrer.find('token=') + 6:]
    except IndexError:
        return jsonify(code=0, msg='请通过正常渠道调用本接口。')
    if is_overdue(token):
        return jsonify(code=0, msg='二维码无效。')
    data = request.form.to_dict()
    survey_id = data.get('survey_id')
    if not data or not data.get('submit_time') or not data.get('source') or not ObjectId.is_valid(survey_id):
        return jsonify(code=0, msg='请通过正常渠道调用本API！')
    data.update(request.files.to_dict())
    data = data_and_condition_handler(data, survey_id)
    try:
        mongo.db.answers.insert_one(data)
    except Exception as e:
        return jsonify(code=0, msg=str(e))
    return jsonify(code=1, msg='提交成功！感谢参与问卷。')


@app.route('/answers', methods=('DELETE', ))
@login_required
def answers_delete_handler():
    if '/summary?id=' not in g.referrer:
        return jsonify(code=0, msg='请通过正常渠道调用本接口！')
    answer_id = request.args.get('id')
    if not answer_id:
        return jsonify(code=0, msg='ID格式错误。')
    try:
        answer = mongo.db.answers.find_one({'_id': ObjectId(answer_id)})
        result = mongo.db.answers.delete_one({'_id': ObjectId(answer_id)})
    except Exception as e:
        return jsonify(code=0, msg=str(e))
    if not answer or result.deleted_count != 1:
        return jsonify(code=0, msg='未查询到该答卷。')
    survey_id = answer.get('survey_id')
    for value in answer.values():
        if isinstance(value, str) and value.startswith(('file|', 'img|')):
            try:
                remove(join(FILE_FOLDER, survey_id, value.split('|')[1]))
            except (NotImplementedError, FileNotFoundError):
                pass
    return jsonify(code=1, msg='删除成功！', count=result.deleted_count)


@app.route('/answers')
@login_required
def answers_get_handler():
    # if '/summary?id=' not in g.referrer:
    #     return jsonify(code=0, msg='请通过正常渠道调用本API！')
    answer_id = request.args.get('id')
    if answer_id:
        try:
            answer = mongo.db.answers.find_one({'_id': ObjectId(answer_id)})
        except Exception as e:
            return jsonify(code=0, msg=str(e))
        if answer:
            answer_wrapper(answer)
            return jsonify(code=1, msg='查询成功。', data=answer)
        return jsonify(code=0, msg='未查询到该答卷。')
    condition = loads(request.args.get('condition'))
    skip = condition.pop('skip', None)
    limit = condition.pop('limit', None)
    survey_id = condition.get('survey_id')
    if not survey_id or not ObjectId.is_valid(survey_id):
        return jsonify(code=0, msg='参数格式错误。')
    data_and_condition_handler(condition)
    if request.args.get('download') is not None:
        try:
            answer_cursor = mongo.db.answers.find(condition)
        except Exception as e:
            return jsonify(code=0, msg=str(e))
        if answer_cursor.count():
            return make_xlsx(survey_id, answer_cursor)
        return jsonify(code=0, msg='未查询到答卷。')
    if skip is None or limit is None:
        return jsonify(code=0, msg='参数格式错误。')
    try:
        answer_cursor = mongo.db.answers.find(condition, {'source': 1, 'submit_time': 1}).skip(skip).limit(limit)
    except Exception as e:
        return jsonify(code=0, msg=str(e))
    if not answer_cursor.count():
        return jsonify(code=0, msg='未查询到答卷。')
    answers = []
    for answer in answer_cursor:
        answer_wrapper(answer)
        answers.append(answer)
    try:
        total_data_num = mongo.db.answers.count_documents({'survey_id': survey_id})
    except Exception as e:
        return jsonify(code=0, msg=str(e))
    if total_data_num is None:
        total_data_num = 0
    return jsonify(code=1, msg='查询成功！', data=answers, filterNum=answer_cursor.count(), dataNum=total_data_num)


@app.route('/summary')
@login_required
def summary_handler():
    survey_id = request.args.get('id')
    if not survey_id or not ObjectId.is_valid(survey_id):
        abort(404)
    surveys = []
    try:
        for survey in mongo.db.surveys.find({'user_id': current_user.user_id}):
            surveys.append({'_id': str(survey.get('_id')), 'title': survey.get('title')})
        if not surveys:
            return show_msg(':(', '您尚未添加任何问卷', '主页', '/home', '无法进行统计与分析。')
        for index, survey in enumerate(surveys):
            if survey_id == survey.get('_id'):
                surveys[0], surveys[index] = surveys[index], surveys[0]
                break
        else:
            return show_msg(':(', '该问卷不属于当前用户', '主页', '/home', '无法进行统计与分析。')
        questions = []
        for question in mongo.db.questions.find({'survey_id': survey_id}):
            questions.append(question)
    except Exception as e:
        return show_msg(':(', '加载失败', '主页', '/home', str(e))
    questions.sort(key=itemgetter('num'))  # 将题目按题号排序
    return render_template('summary.html', surveys=surveys, questions=questions)


@app.route('/share')
@login_required
def share_handler():
    survey_id = request.args.get('id')
    try:
        time = int(request.args.get('time'))
    except (ValueError, TypeError):
        return jsonify(code=0, msg='参数格式错误。')
    if not survey_id or time < 1 or time > 999 or not ObjectId.is_valid(survey_id):
        return jsonify(code=0, msg='参数格式错误。')
    try:
        result = mongo.db.surveys.count_documents({'_id': ObjectId(survey_id)})
        if result != 1:
            return jsonify(code=0, msg='未查询到该问卷。')
        end_date = datetime.now() + timedelta(days=time)
        # end_date = Cryptor(KEY).encrypt('{}-{}-{}'.format(end_date.year, end_date.month, end_date.day))
        end_date = AESCryptor(KEY1).encrypt(end_date.strftime('%Y-%m-%d'))
        url = '{}/surveys?id={}&token={}'.format(DOMAIN, survey_id, end_date)
        out = BytesIO()
        make(url).save(out, format='png')
        out.seek(0)
        return jsonify(code=1, msg='分享成功。', data=b64encode(out.read()).decode(), url=url)
    except Exception as e:
        return jsonify(code=0, msg=str(e))
