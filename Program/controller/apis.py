from uuid import uuid1
from json import loads
from io import BytesIO
from qrcode import make
from shutil import rmtree
from bson import ObjectId
from base64 import b64encode
from os import mkdir, remove
from os.path import join, isfile
from datetime import datetime, timedelta

from flask_restful import Resource
from flask import g, session, request, jsonify, send_file, url_for, redirect
from flask_login import current_user, login_user, logout_user, login_required

from Program import model
from Program import app, api, mongo
from Program.controller.routers import is_overdue, is_safe_url, data_and_condition_handler, answer_wrapper, make_xlsx
from Program.controller.utils import generate_captcha_text_and_image, AESCryptor, SMTPEmail
from setting import FILE_FOLDER, KEY1, KEY2, REGISTER_CODES, USED_REGISTER_CODES, PERMANENT_SESSION_LIFETIME, DOMAIN


class CaptchaHandler(Resource):
    def get(self):
        last_request_time = session.get('captcha_time')
        now = datetime.now()
        if last_request_time and (now - last_request_time).seconds < 2:
            return jsonify(code=0, msg='请求频率过快。')
        text, data_url = generate_captcha_text_and_image()
        session['captcha'] = AESCryptor(KEY1).encrypt(text)
        session['captcha_time'] = now
        return jsonify(code=1, data=data_url)


class FileHandler(Resource):
    # @login_required
    def get(self):
        filename = request.args.get('filename')
        survey_id = request.args.get('survey_id')
        if not filename or not survey_id or not ObjectId.is_valid(survey_id):
            return jsonify(code=0, msg='参数格式错误。')
        file_path = join(FILE_FOLDER, survey_id, filename)
        if not isfile(file_path):
            return jsonify(code=0, msg='文件不存在。')
        return send_file(file_path, as_attachment=True,
                         attachment_filename=filename[filename.find('_', filename.find('_') + 1) + 1:])


class UserHandler(Resource):
    def post(self):
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

    def put(self):
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


class LoginHandler(Resource):
    def post(self):
        if current_user is not None and current_user.is_authenticated:
            return redirect(url_for('home_handler'))
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


class LogoutHandler(Resource):
    @login_required
    def get(self):
        username = current_user.username
        logout_user()
        return redirect(url_for('index_handler', last_username=username))


class ResetHandler(Resource):
    def post(self):
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


class DesignHandler(Resource):
    @login_required
    def post(self):
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


class SurveyHandler(Resource):
    @login_required
    def post(self):
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

    @login_required
    def put(self):
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

    @login_required
    def delete(self):
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
        rmtree(join(FILE_FOLDER, survey_id))  # 删除问卷的文件夹
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


class AnswerHandler(Resource):
    @login_required
    def get(self):
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

    def post(self):
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

    @login_required
    def delete(self):
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


class ShareMsgHandler(Resource):
    @login_required
    def get(self):
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


api.add_resource(CaptchaHandler, '/captcha')
api.add_resource(FileHandler, '/files')
api.add_resource(UserHandler, '/users')
api.add_resource(LoginHandler, '/', '/login')
api.add_resource(LogoutHandler, '/logout')
api.add_resource(ResetHandler, '/reset')
api.add_resource(DesignHandler, '/design')
api.add_resource(SurveyHandler, '/surveys')
api.add_resource(AnswerHandler, '/answers')
api.add_resource(ShareMsgHandler, '/share_msg')
