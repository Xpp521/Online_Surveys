from flask_login import UserMixin


class User(UserMixin):

    def __init__(self, user_id, username, password, email, jurisdiction):
        self.user_id = str(user_id)
        self.username = username
        self.password = password
        self.email = email
        self.jurisdiction = jurisdiction

    @property
    def is_active(self):
        return True

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def get_id(self):
        return self.user_id

    def __repr__(self) -> str:
        return self.username




# class UserAddApi(Resource):
#     def get(self):
#         result = []
#         for user_info in mongo.db.users.find():
#             result.append({'name': user_info.get('name'), 'pwd': user_info.get('pwd')})
#         return result
#
#     def post(self):
#         data = request.get_json()
#         if not data:
#             return 0
#         try:
#             mongo.db.users.insert_one(data)
#         except Exception as e:
#             logger.warning(e)
#             return 0
#         return 1


# class UserResource(Resource):
#     def delete(self, username):
#         try:
#             mongo.db.delete_one({'name': username})
#         except Exception as e:
#             logger.warning(e)
#             return 0
#         return 1
#
#     def put(self, username):
#         data = request.get_json()
#         if not data:
#             return 0
#         try:
#             mongo.db.update_one({'name': username}, data)
#         except Exception as e:
#             logger.warning(e)
#             return 0
#         return 1
#
#     def get(self, username):
#         user_info = mongo.db.users.find_one({'name': username})
#         return {'name': user_info.get('name'), 'pwd': user_info.get('pwd')}
#
#
# api.add_resource(UserResource, '/user/<string:username>')
# api.add_resource(UserAddApi, '/user')
