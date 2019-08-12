from datetime import timedelta
from random import choice
from os.path import abspath, join


class Config:
    """
    Flask app设置
    """

    # 是否开启调试模式
    DEBUG = False

    # Flask密钥
    SECRET_KEY = '1j9asdjo/.fds.;#%sakoff'

    # MongoDB数据库URI
    # 格式：'mongodb://用户名:密码@地址:端口号/数据库名'。
    MONGO_URI = 'mongodb://flask:flaskmongodb@localhost:27017/flask'


# 主机地址
HOST = '0.0.0.0'

# 端口号
PORT = 5000

# 外网地址（域名）
# 从内网穿透软件中获取。
DOMAIN = 'http://3s.dkys.org:18293'

# Session过期时间
# 代表用户保持登录状态的时间。
# 参数中的hours=1代表1小时、days=7代表7天、weeks=2代表2周……
PERMANENT_SESSION_LIFETIME = timedelta(hours=1)

# 储存用户上传文件的文件夹
# 更改时路径必须填绝对路径。若原路径中存在用户上传的文件，务必将其移动到新路径中，否则会导致下载文件等功能失效。
# 例：FILE_FOLDER = r'D:\My_Pictures'。
FILE_FOLDER = abspath(join('', 'Program', 'model'))

# 是否开放注册系统
REGISTER_STATUS = 1

# 验证码长度
QR_CODE_LENGTH = 4

# 注册码长度
REGISTER_CODE_LENGTH = 5

# 注册码数量
REGISTER_CODE_COUNT = 10

# ——————————————密匙设置：开始——————————————
# 为防止破解建议经常更换，复杂度越高越好，但长度不能超过32位。

# 密匙1
# 更换后会导致已经分享的二维码失效。
KEY1 = '1=ef-dsk34retj,.@#%vwi!@`6do3m*)'

# KEY= '12345678901234567890123456789012'（32位）

# 密匙2
KEY2 = '19dsf_@!fd(^$vslc-2+%#`lmtci{#z7'
# ——————————————密匙设置：结束——————————————

# ——————————————邮件参数设置：开始——————————————
# smtp服务器地址
SMTP_HOST = 'smtp.qq.com'

# smtp服务器端口号
SMTP_PORT = '465'

# 发送邮件的邮箱账号
EMAIL_ACCOUNT = '3376459813@qq.com'

# 发送邮件的邮箱昵称
EMAIL_ACCOUNT_NAME = '在线问卷系统'

# 授权码
EMAIL_AUTH_CODE = 'sissbbaxqcoachdi'
# ——————————————邮件参数设置：结束——————————————

# 用于生成注册码和验证码的字符集
CHARSET = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K',
           'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U',
           'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p',
           'q', 'r', 's', 't', 'u',
           'v', 'w', 'x', 'y', 'z']

# 注册码
REGISTER_CODES = []

# 用过的注册码
USED_REGISTER_CODES = []


def generate_register_code(register_code_count=REGISTER_CODE_COUNT, register_code_length=REGISTER_CODE_LENGTH):
    # 开始生成注册码
    count = 1
    while count <= register_code_count:
        register_code = ''
        for _ in range(register_code_length):
            register_code += choice(CHARSET)
        if register_code in REGISTER_CODES:
            continue
        REGISTER_CODES.append(register_code)
        count += 1
    print('本次注册码：')
    for code in REGISTER_CODES:
        print(code, end='\t')
    print('\n')


if REGISTER_STATUS:
    generate_register_code()
