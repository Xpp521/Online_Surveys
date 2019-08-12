let curMatrixFill;
let shadow = document.getElementById('shadow');
let widgets = {};
widgets['msg'] = document.getElementById('msg');
widgets['msg'].style.width = '300px';
widgets['msg'].style.height = '250px';
widgets['msg'].style.left = `${document.body.clientWidth / 2 - 300 / 2}px`;
widgets['msg'].style.top = `${document.documentElement.clientHeight / 2 - 250 / 2}px`;
widgets['mpd'] = document.getElementById('mpdDiv');
widgets['mpd'].style.width = '370px';
widgets['mpd'].style.height = '380px';
widgets['mpd'].style.left = `${document.body.clientWidth / 2 - 370 / 2}px`;
widgets['matrixInput'] = document.getElementById('matrixinput');
widgets['matrixInput'].onblur = function () {
    if (!curMatrixFill) {
        return;
    }
    let input_tag = document.getElementById(curMatrixFill.parentNode.parentNode.getAttribute('fid'));
    if ('' === this.value) {
        input_tag.value = '';
        curMatrixFill.classList.remove('rate-on', 'rate-ontxt');
    } else {
        input_tag.value = `${curMatrixFill.parentNode.parentNode.parentNode.firstElementChild.children[parseInt(curMatrixFill.getAttribute('dval'))].innerText}〖${this.value}〗`;
        js_fireEvent(input_tag, 'change');
    }
    this.parentNode.style.display = 'none';
};
const xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
xhr.responseType = 'json';
xhr.onreadystatechange = function () {
    let msg_text = widgets['msg'].querySelector('#msg_text');
    switch (xhr.readyState) {
        case 1:
            let scrollTop = document.documentElement.scrollTop || window.pageYOffset || document.body.scrollTop;
            widgets['msg'].style.top = `${document.documentElement.clientHeight / 2 - 300 / 2 + scrollTop}px`;
            shadow.style.display = '';
            widgets['msg'].style.display = '';
            msg_text.innerHTML = '正在提交……';
            break;
        case 4:
            widgets['msg'].style.display = 'none';
            shadow.style.display = 'none';
            if (xhr.status === 200) {
                let response = xhr.response;
                if (response.code === 1) {
                    alert(response.msg);
                    location.replace('/');
                } else {
                    alert(`提交失败：${response.msg}`);
                }
            } else {
                alert(`提交失败：${xhr.status}`);
            }
            break;
    }
};
init();
function init() {
    let tags = document.querySelectorAll('.field');
    for (let i=0, len=tags.length; i<len; i++){
        let tag = tags[i];
        if (tag.getAttribute('attach')) {
            let attach = JSON.parse(tag.getAttribute('attach').replace(/'/g, '"'));
            let type = tag.getAttribute('attach_type');
            if (type) {
                let input_tags = [];
                for (let i=0, len=attach.length; i<len; i++) {
                    let input_tag = document.getElementById(attach[i].k);
                    input_tags.push(input_tag);
                    input_tag.addEventListener('change', function () {
                        let status;
                        if (this.value === attach[i].v) {
                            if ('or' === type) {
                                tag.style.display = '';
                                return;
                            }
                            status = 1;
                            for (let j=0, len=input_tags.length; j<len; j++) {
                                status = status & (input_tags[j].value === attach[j].v ? 1 : 0);
                            }
                        } else {
                            if ('and' === type) {
                                tag.style.display = 'none';
                                tag.value = '';
                                return;
                            }
                            status = 0;
                            for (let j=0, len=input_tags.length; j<len; j++) {
                                status = status || (input_tags[j].value === attach[j].v ? 1 : 0);
                            }
                        }
                        if (status) {
                            tag.style.display = '';
                        } else {
                            tag.style.display = 'none';
                            tag.value = '';
                        }
                    });
                }
            } else {
                document.querySelector(`#${attach[0].k}`).addEventListener('change', function () {
                    if (attach[0].v ===this.value) {
                        tag.style.display = '';
                    } else {
                        tag.style.display = 'none';
                        tag.value = '';
                    }
                });
            }
        }
        switch (tag.getAttribute('type')) {
            case '单项选择':
                let input_tag = tag.querySelector('input');
                let options = tag.querySelectorAll('div.ui-radio');
                for (let i=0, len=options.length; i<len; i++){
                    let that = options[i];
                    that.onclick = function () {
                        let selected_option = tag.querySelector('a.jqchecked');
                        if (selected_option) {
                            selected_option.classList.remove('jqchecked');
                        }
                        input_tag.value = that.querySelector('div').innerText;
                        js_fireEvent(input_tag, 'change');
                        that.querySelector('a.jqradio').classList.add('jqchecked');
                    };
                }
                break;
            case '下拉单选':
                let select_tag = tag.querySelector('select');
                select_tag.addEventListener('change', function () {
                    tag.querySelector('div.ui-select span').innerText = select_tag.querySelector(`option[value="${select_tag.value}"]`).innerText;
                });
                break;
            case '矩阵单选':
                let divMatrixRel = widgets['matrixInput'].parentNode;
                let trs = tag.querySelectorAll('tr[tp]');
                for (let i=0, len=trs.length; i<len; i++){
                    let tr = trs[i];
                    let tds = tr.querySelectorAll('td');
                    for (let i=0, len=tds.length; i<len; i++){
                        tds[i].onclick = function () {
                            divMatrixRel.style.display = 'none';
                            curMatrixFill = this.querySelector('a');
                            let input_tag = tag.querySelector(`#${tr.getAttribute('fid')}`);
                            let selected_option = tr.querySelector('a.rate-on');
                            if (selected_option && (!curMatrixFill.getAttribute('needfill') || !selected_option.getAttribute('needfill'))) {
                                selected_option.classList.remove('rate-on', 'rate-ontxt');
                                input_tag.value = '';
                            }
                            if (curMatrixFill.getAttribute('needfill')) {
                                let top = curMatrixFill.getBoundingClientRect().top + (window.pageYOffset||document.documentElement.scrollTop) - (document.documentElement.clientTop||0) + 25;
                                let value = input_tag.value;
                                if (!value || -1 === value.indexOf('〖')) {
                                    widgets['matrixInput'].value = '';
                                } else {
                                    widgets['matrixInput'].value = value.substring(value.indexOf('〖') + 1, value.indexOf('〗'));
                                }
                                divMatrixRel.style.top = `${top}px`;
                                divMatrixRel.style.display = '';
                                widgets['matrixInput'].focus();
                            } else {
                                input_tag.value = curMatrixFill.parentNode.parentNode.parentNode.firstElementChild.children[parseInt(curMatrixFill.getAttribute('dval'))].innerText;
                                js_fireEvent(input_tag, 'change');
                            }
                            curMatrixFill.classList.add('rate-on', 'rate-ontxt');
                        }
                    }
                }
                break;
            case '文件':
                let msg = tag.querySelector('div.uploadmsg');
                let exts = tag.getAttribute('ext');
                let size = parseFloat(tag.getAttribute('size'));
                tag.querySelector('input').onchange = function () {
                    let that = this;
                    if (!that.files.length) {
                        msg.innerHTML = '';
                        return;
                    }
                    let ext = that.value.substring(that.value.lastIndexOf('.'));
                    if (-1 === exts.indexOf(ext.toLowerCase())) {
                        msg.innerHTML = `文件扩展名只能为：${exts}，您选择的文件扩展名为：${ext}。`;
                        that.value = '请选择';
                        return;
                    }
                    let file = that.files[0];
                    if (file.size / 1024 > size) {
                        msg.innerHTML = `此题上传文件的大小限制为${size / 1024}M，您选择的文件大小为：${(file.size / (1024 * 1024)).toFixed(2)}M。`;
                        that.value = '请选择';
                        return;
                    }
                    if (file.type.startsWith('image/')) {
                        let reader = new FileReader();
                        reader.onloadstart = function () {
                            msg.innerHTML = '正在加载图片，请稍候……';
                        };
                        reader.onload = function () {
                            msg.innerHTML = `<div>已选择图片：${file.name}</div><img src="${this.result}" width="50%" alt="${file.name}">`;
                        };
                        reader.onerror = function () {
                            msg.innerHTML = '读取图片时发生错误，请尝试重新选择！';
                            that.value = '';
                        };
                        reader.readAsDataURL(file);
                    } else {
                        msg.innerHTML = `已选择文件：${file.name}`;
                    }

                };
                break;
            case '日期':
                tag.querySelector('input.datebox').onclick = function () {
                    let that = this;
                    that.blur();
                    let year, month, date;
                    if (that.value) {
                        let arr = that.value.split('-');
                        year = parseInt(arr[0]);
                        month = parseInt(arr[1]);
                        date = parseInt(arr[2]);
                    } else {
                        let myDate = new Date();
                        year = myDate.getFullYear();
                        month = myDate.getMonth() + 1;
                        date = myDate.getDate();
                    }
                    weui.datePicker({
                        start: 1987,
                        end: 2050,
                        defaultValue: [year, month, date],
                        onConfirm: function (r) {
                            if (!r || r.length === 0) {
                                return;
                            }
                            that.value = r.join('-');
                            js_fireEvent(that, 'change');
                        },
                        id: "date_" + that.id
                    });
                };
                break;
        }
    }
}
function changeSelectText(select_tag) {
    select_tag.parentNode.firstElementChild.innerHTML = select_tag.value;
}
function show_mpd(tag, layers, options) {
    let html = '';
    for (let i = 0; i < layers; i++) {
        html += `<div class="ui-select" style="margin-top:10px;"><div class="ui-btn ui-icon-carat-d ui-btn-icon-right ui-corner-all ui-shadow"><span>请选择</span><div class="arrowT"><div class="arrowt"></div></div><select id="s${i + 1}"></select></div></div>`;
    }
    widgets['mpd'].querySelector('#select_tags').innerHTML = html;
    let layer = [];
    for (let i = 0, len = layers; i < len; i++) {
        layer[i] = [];
    }
    for (let j = 0, ops = options.sort(compare('index')), len = ops.length; j < len; j++) {
        layer[ops[j].layer_num - 1].push(ops[j]);
    }
    let select = [];
    for (let m = 1; m <= layers; m++) {
        select.push(widgets['mpd'].querySelector(`#s${m}`));
    }
    html = '<option value=请选择>请选择</option>';
    for (let k = 0, la = layer[0], len = la.length; k < len; k++) {
        html += `<option value=${la[k].content}>${la[k].content}</option>`;
    }
    select[0].innerHTML = html;
    for (let n = 1; n < layers; n++) {
        select[n - 1].onchange = function () {
            changeSelectText(select[n - 1]);
            html = '<option value=请选择>请选择</option>';
            let p_index = '';
            for (let i = 0, la = layer[n - 1], len = la.length; i < len; i++) {
                if (select[n - 1].value === la[i].content) {
                    p_index = la[i].index;
                    break;
                }
            }
            for (let j = 0, la = layer[n], len = la.length; j < len; j++) {
                if (p_index === la[j].p_index) {
                    html += `<option value=${la[j].content}>${la[j].content}</option>`;
                }
            }
            select[n].innerHTML = html;
        };
    }
    select[layers - 1].onchange = function () {
        changeSelectText(select[layers - 1]);
    };
    widgets['mpd'].querySelector('a.button_a').onclick = function () {
        let resultArray = [];
        let selects = widgets['mpd'].querySelectorAll('select');
        for (let i=0, len=selects.length; i<len; i++){
            if ('请选择' === selects[i].value) {
                alert(`请选择${i + 1}级选项！`);
                return;
            }
            resultArray.push(selects[i].value);
        }
        tag.value = resultArray.join('-');
        js_fireEvent(tag, 'change');
        widgets['mpd'].style.display = 'none';
        shadow.style.display = 'none';
    };
    shadow.style.display = '';
    let scrollTop = document.documentElement.scrollTop || window.pageYOffset || document.body.scrollTop;
    widgets['mpd'].style.top = `${document.documentElement.clientHeight / 2 - 380 / 2 + scrollTop}px`;
    widgets['mpd'].style.display = '';
}
function closeWidget(tag) {
    if (shadow === tag) {
        Object.keys(widgets).forEach(function (key) {
            widgets[key].style.display = 'none';
        });
    } else {
        tag.parentNode.parentNode.style.display = 'none';
    }
    shadow.style.display = 'none';
}
function js_fireEvent(tag, event) {
    if ('createEvent' in document) {
        let e = document.createEvent('HTMLEvents');
        e.initEvent(event, false, true);
        tag.dispatchEvent(e);
    } else {
        tag.fireEvent(`on${event}`);
    }
}
const compare = function (prop) {
    return function (o1, o2) {
        let v1 = o1[prop], v2 = o2[prop];
        if (!isNaN(Number(v1)) && !isNaN(Number(v2))) {
            v1 = Number(v1);
            v2 = Number(v2);
        }
        if (v1 < v2) {
            return -1;
        } else if (v1 > v2) {
            return 1;
        } else {
            return 0;
        }
    }
};
Date.prototype.Format = function (fmt) {
    let o = {
        "M+": this.getMonth() + 1,                 //月份
        "d+": this.getDate(),                    //日
        "h+": this.getHours(),                   //小时
        "m+": this.getMinutes(),                 //分
        "s+": this.getSeconds(),                 //秒
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度
        // "S"  : this.getMilliseconds()             //毫秒
    };
    if (/(y+)/.test(fmt))
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (let k in o)
        if (new RegExp("(" + k + ")").test(fmt))
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
};
function ok() {
    document.querySelector('#q_submit_time').value = `date_${(new Date()).Format('yyyy-M-d')}`;
    let result = {};
    let tags = document.querySelectorAll('[id^=q]');
    let data = new FormData();
    for (let i=0, len=tags.length; i<len; i++){
        let tag = tags[i];
        let question_div = document.getElementById(`div${tag.id.substring(1, -1 === tag.id.indexOf('_') ? undefined : tag.id.indexOf('_'))}`);
        if (!question_div) {
            data.append(tag.id.replace('q_', '').replace('q', ''), tag.value);
            continue;
        }
        if (question_div.style.display === 'none') {
            continue;
        }
        if (tag.value && tag.value !== '请选择') {
            question_div.lastElementChild.innerHTML = '';
        } else {
            if (question_div.getAttribute('required')) {
                question_div.lastElementChild.innerHTML = '请完善此题的答案！';
                question_div.scrollIntoView();
                return;
            } else {
                continue;
            }
        }
        if ('datebox' === tag.className) {
            data.append(tag.name.replace('q_', '').replace('q', ''), `date_${tag.value}`);
        }
        else if (tag.files) {
            data.append(tag.name.replace('q_', '').replace('q', ''), tag.files[0]);
        } else {
            data.append(tag.name.replace('q_', '').replace('q', ''), tag.value);
        }
    }
    xhr.open('POST', '/answers');
    xhr.send(data);
}