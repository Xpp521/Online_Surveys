from Crypto.Cipher import AES
from base64 import encodebytes, decodebytes, b64encode
from random import choice
from captcha.image import ImageCaptcha
from smtplib import SMTP_SSL
from email.utils import formataddr
from email.mime.text import MIMEText
from setting import CHARSET, SMTP_HOST, SMTP_PORT, EMAIL_ACCOUNT, EMAIL_ACCOUNT_NAME, EMAIL_AUTH_CODE, QR_CODE_LENGTH


def generate_captcha_text_and_image(length=QR_CODE_LENGTH):
    """
    生成随机验证码。
    :param length: 验证码长度。
    :return: 验证码字符串和data url。
    """
    text = []
    for _ in range(length):
        text.append(choice(CHARSET))
    return ''.join(text), b64encode(ImageCaptcha().generate(text, 'jpeg').read()).decode()


class SMTPEmail:
    """
    基于SMTP协议的邮件类。
    """
    def __init__(self, account=EMAIL_ACCOUNT, account_name=EMAIL_ACCOUNT_NAME, auth_code=EMAIL_AUTH_CODE,
                 smtp_host=SMTP_HOST, smtp_port=SMTP_PORT):
        """
        :param account:邮箱账号。
        :param account_name:发送者昵称。
        :param auth_code: 授权码。
        :param smtp_host: SMTP服务器地址。
        :param smtp_port: SMTP服务器端口号。
        """
        self.account = account
        self.account_name = account_name
        self.server = SMTP_SSL(smtp_host, smtp_port)
        # 登录SMTP服务器。
        self.server.login(account, auth_code)

    def send(self, receiver_addr, subject, body, subtype='plain'):
        """
        发送邮件方法。
        :param receiver_addr: 收件人邮箱地址。
        :param subject: 主题。
        :param body: 正文。
        :param subtype: 邮件编码类型。
        :return: 成功返回1，失败返回失败原因。
        """
        try:
            msg = MIMEText(body, subtype, 'utf-8')
            msg['Subject'] = subject
            msg['From'] = formataddr([self.account_name, self.account])
            msg['To'] = receiver_addr
            self.server.sendmail(self.account, [receiver_addr, ], msg.as_string())
        except Exception as e:
            return str(e)
        return 1

    def __del__(self):
        """
        终止SMTP会话。
        """
        self.server.quit()


class AESCryptor:
    """
    AES算法加密解密类
    """
    def __init__(self, key):
        """
        :param key: 密匙。
        """
        self.aes = AES.new(self.add_to_16(key), AES.MODE_ECB)

    @staticmethod
    def add_to_16(s):
        length = len(s)
        if length % 16 == 0:
            add = 0
        else:
            add = 16 - (length % 16)
        return '{}{}'.format(s, '\0' * add).encode()

    def encrypt(self, text):
        if not text:
            return ''
        return str(encodebytes(self.aes.encrypt(self.add_to_16(text))), encoding='utf-8').replace('\n', '')

    def decrypt(self, text):
        if not text:
            return ''
        return str(self.aes.decrypt(decodebytes(bytes(text, encoding='utf-8'))).rstrip(b'\0').decode("utf-8"))
