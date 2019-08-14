from flask import Flask, logging
from flask_pymongo import PyMongo
from flask_login.login_manager import LoginManager
from flask_restful import Api
from setting import Config

app = Flask(__name__, static_folder='view/static', template_folder='view/templates')
app.config.from_object(Config)
logger = logging.create_logger(app)
mongo = PyMongo(app)
login_manager = LoginManager()
login_manager.login_view = '/login'
login_manager.login_message = '请先登录。'
login_manager.session_protection = 'strong'
login_manager.init_app(app)
api = Api(app)
