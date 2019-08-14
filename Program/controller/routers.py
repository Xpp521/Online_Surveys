from io import BytesIO
from os.path import join, getsize
from re import compile
from operator import itemgetter
from PIL import Image
from openpyxl import Workbook
from base64 import b64encode
from bson import ObjectId
from uuid import uuid1
from datetime import datetime
from werkzeug.datastructures import FileStorage
from flask import request, render_template, redirect, abort, url_for, send_file, g
from flask.json import jsonify
from flask_login import login_required, current_user

from Program import app, mongo, login_manager, model
from Program.controller.utils import AESCryptor
from setting import REGISTER_STATUS
from setting import FILE_FOLDER, DOMAIN, KEY1, KEY2


@app.route('/favicon.ico')
def favicon():
    return send_file(join(app.root_path, 'view', 'static', 'image', 'favicon.ico'))


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


@app.route('/reset')
def reset_handler():
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


@app.route('/')
@app.route('/login')
def index_handler():
    if current_user is not None and current_user.is_authenticated:
        return redirect(url_for('home_handler'))
    last_username = request.args.get('last_username')
    return render_template('login.html', last_username=last_username if last_username else '',
                           register_status=REGISTER_STATUS)


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
