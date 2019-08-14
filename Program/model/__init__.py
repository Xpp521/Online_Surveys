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
