from Program import app
from Program.controller import controller, api
from setting import HOST, PORT

if __name__ == '__main__':
    app.run(host=HOST, port=PORT)
