let survey_header;
let survey_note;
let survey_public;
let curQuestion = {};
let abandoned_questions = [];
const shadow = document.getElementById('shadow');
const content = document.getElementById('content');
const question_list = document.getElementById('question_list');
const widget_mpd = document.getElementById('mpd');
const widget_msg = document.getElementById('msg');
const widget_header_editor = document.getElementById('mod_header');
const widget_attach_editor = document.getElementById('mod_attach');
const widget_type_selector = document.getElementById('select_type');
const widget_question_editor = document.getElementById('mod_question');
const q_ext = document.getElementById('q_ext');
const q_size = document.getElementById('q_size');
const q_rows = document.getElementById('q_rows');
const q_title = document.getElementById('q_title');
const q_layers = document.getElementById('q_layers');
const q_titles = document.getElementById('q_titles');
const q_attach = document.getElementById('q_attach');
const q_options = document.getElementById('q_options');
const q_setting = document.getElementById('questionSetting');
const q_is_required = widget_question_editor.querySelector('#q_is_required span');
const xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
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
init();

function init() {
    let header = content.firstElementChild.firstElementChild;
    survey_header = header.firstElementChild;
    survey_note = header.firstElementChild.nextElementSibling;
    survey_public = header.lastElementChild.firstElementChild;
    document.getElementById('survey_public').value = survey_public.innerHTML;
    for (let i = 0, len = questions.length; i < len; i++) {
        render_question(questions[i]);
    }
    shadow.ontouchmove = prevent_touch_move_event;
    widget_mpd.ontouchmove = prevent_touch_move_event;
    widget_msg.ontouchmove = prevent_touch_move_event;
    widget_type_selector.ontouchmove = prevent_touch_move_event;
    xhr.responseType = 'json';
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 1) {
            let scrollTop = document.documentElement.scrollTop || window.pageYOffset || document.body.scrollTop;
            shadow.style.top = `${scrollTop}px`;
            shadow.style.display = '';
            widget_msg.style.top = `${document.documentElement.clientHeight * 0.2 + scrollTop}px`;
            widget_msg.style.display = '';
            shadow.onclick = null;
            prevent_slide(true);
        }
        else if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                let response = xhr.response;
                if (response['code'] === 1) {
                    alert(response['msg']);
                    location.replace('/home');
                } else {
                    alert(response['msg']);

                }
            } else {
                alert(`问卷更新失败。错误码：${xhr.status}`);
            }
            widget_msg.style.display = 'none';
            shadow.style.display = 'none';
            prevent_slide(false);
        }
    };
    let useless_tag = document.getElementById('useless');
    useless_tag.parentNode.removeChild(useless_tag);
}

function prevent_touch_move_event(e) {
    e.preventDefault();
    e.stopPropagation();
    e.returnValue = false;
}

function prevent_slide(flag) {
    if (flag) {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.onkeydown = function (e) {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                e.returnValue = false;
                e.stopPropagation();
                return false;
            }
        };
    } else {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.onkeydown = null;
        shadow.ontouchstart = null;
    }
}

function save_survey() {
    let submit_survey = {'_id': survey_id, 'title': survey_header.innerHTML, 'note': survey_note.innerHTML, 'public': parseInt(survey_public.innerHTML)};
    let submit_questions = [];
    for (let i = 0, len = questions.length; i < len; i++) {
        if (questions[i]['new']) {
            submit_questions.push(questions[i]);
        }
    }
    xhr.open('POST', '/design');
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.send(`survey=${JSON.stringify(submit_survey)}&update=${JSON.stringify(submit_questions)}&delete=${JSON.stringify(abandoned_questions)}`);
}

function show_edit_menu(tag) {
    tag.nextElementSibling.style.display = '';
    tag.parentNode.classList.add('current');
}

function hide_edit_menu(tag) {
    tag.lastElementChild.style.display = 'none';
    tag.classList.remove('current');
}

function show_header_editor() {
    content.lastElementChild.style.height = '0px';
    widget_header_editor.style.display = '';
}

function hide_header_editor(cancel = false) {
    let input_tag = widget_header_editor.querySelector('input');
    let textarea_tag = widget_header_editor.querySelector('textarea');
    let select_tag = widget_header_editor.querySelector('select');
    if (cancel) {
        input_tag.value = survey_header.innerHTML;
        textarea_tag.value = survey_note.innerHTML;
        select_tag.value = survey_public.innerHTML;
    } else {
        if (input_tag.value) {
            input_tag.parentNode.nextElementSibling.innerHTML = '';
        } else {
            input_tag.parentNode.nextElementSibling.innerHTML = '请填写问卷名称';
            return;
        }
        survey_header.innerHTML = input_tag.value;
        survey_note.innerHTML = textarea_tag.value;
        survey_public.innerHTML = select_tag.value;
        if (parseInt(select_tag.value)) {
            survey_public.nextElementSibling.innerHTML = '公开问卷';
        } else {
            survey_public.nextElementSibling.innerHTML = '私密问卷';
        }
    }
    widget_header_editor.style.display = 'none';
    content.lastElementChild.style.height = '';
}

function enter_hide_header_editor(e) {
    if (e.key === 'Enter') {
        hide_header_editor();
    }
}

function show_type_selector() {
    let scrollTop = document.documentElement.scrollTop || window.pageYOffset || document.body.scrollTop;
    shadow.style.top = `${scrollTop}px`;
    widget_type_selector.style.top = `${document.documentElement.clientHeight / 2 - 300 / 2 + scrollTop}px`;
    shadow.style.display = '';
    widget_type_selector.style.display = '';
    shadow.onclick = function () {
        widget_type_selector.style.display = 'none';
        shadow.style.display = 'none';
        prevent_slide(false);
    };
    prevent_slide(true);
}

function show_mpd(tag) {
    let question = questions[parseInt(tag.parentNode.parentNode.id.replace('div', '')) - 1];
    let layers = question['layers'];
    let html = [];
    for (let i = 0; i < layers; i++) {
        html.push(`<div class="ui-select" style="margin-top:10px;"><div class="ui-btn ui-icon-carat-d ui-btn-icon-right ui-corner-all ui-shadow"><span>请选择</span><div class="arrowT"><div class="arrowt"></div></div><select id="s${i + 1}"></select></div></div>`);
    }
    widget_mpd.querySelector('#select_tags').innerHTML = html.join('');
    let layer = [];
    for (let i = 0, len = layers; i < len; i++) {
        layer[i] = [];
    }
    for (let j = 0, ops = question['options'].sort(compare('index')), len = ops.length; j < len; j++) {
        layer[ops[j].layer_num - 1].push(ops[j]);
    }
    let select = [];
    for (let m = 1; m <= layers; m++) {
        select.push(widget_mpd.querySelector(`#s${m}`));
    }
    html = ['<option value=请选择>请选择</option>'];
    for (let k = 0, la = layer[0], len = la.length; k < len; k++) {
        html.push(`<option value=${la[k].content}>${la[k].content}</option>`);
    }
    select[0].innerHTML = html.join('');
    for (let n = 1; n < layers; n++) {
        select[n - 1].onchange = function () {
            html = ['<option value=请选择>请选择</option>'];
            let p_index = '';
            for (let i = 0, la = layer[n - 1], len = la.length; i < len; i++) {
                if (select[n - 1].value === la[i].content) {
                    p_index = la[i].index;
                    break;
                }
            }
            for (let j = 0, la = layer[n], len = la.length; j < len; j++) {
                if (p_index === la[j].p_index) {
                    html.push(`<option value=${la[j].content}>${la[j].content}</option>`);
                }
            }
            select[n].innerHTML = html.join('');
            changeSelectText(select[n - 1]);
            changeSelectText(select[n]);
        };
    }
    select[layers - 1].onchange = function () {
        changeSelectText(select[layers - 1]);
    };
    let scrollTop = document.documentElement.scrollTop || window.pageYOffset || document.body.scrollTop;
    shadow.style.top = `${scrollTop}px`;
    shadow.style.display = '';
    widget_mpd.style.top = `${document.documentElement.clientHeight * 0.2 + scrollTop}px`;
    widget_mpd.style.display = '';
    shadow.onclick = function () {
        widget_mpd.style.display = 'none';
        shadow.style.display = 'none';
        prevent_slide(false);
    };
    prevent_slide(true);
}

function changeSelectText(select_tag) {
    select_tag.parentNode.firstElementChild.innerHTML = select_tag.value;
}

function render_question(question, scroll = false) {
    let tag = [];
    switch (question['type']) {
        case '单项选择':
            tag.push(`<div class="q_list_text" onclick="show_edit_menu(this);"><h2><em>${parseInt(question['num'])}.</em><span>${question['title']}</span>`);
            if (question['is_required']) {
                tag.push('<em class="must">*</em></h2>');
            } else {
                tag.push('</h2>');
            }
            for (let i = 0, options = question['options'], len = options.length; i < len; i++) {
                tag.push(`<div>○&nbsp;${options[i]}</div>`);
            }
            break;
        case '下拉单选':
            tag.push(`<div class="q_list_text" onclick="show_edit_menu(this);"><h2><em>${parseInt(question['num'])}.</em><span>${question['title']}</span>`);
            if (question['is_required']) {
                tag.push('<em class="must">*</em></h2><select class="ui-select-box">');
            } else {
                tag.push('</h2><select class="ui-select-box">');
            }
            for (let i = 0, options = question['options'], len = options.length; i < len; i++) {
                tag.push(`<option>${options[i]}</option>`);
            }
            tag.push('</select>');
            break;
        case '单项填空':
            tag.push(`<div class="q_list_text" onclick="show_edit_menu(this);"><h2><em>${parseInt(question['num'])}.</em><span>${question['title']}</span>`);
            if (question['is_required']) {
                tag.push(`<em class="must">*</em></h2><div><div class="ui-group-box" style="height: ${question['rows'] * 30}px"></div></div>`);
            } else {
                tag.push(`</h2><div><div class="ui-group-box" style="height: ${question['rows'] * 30}px"></div></div>`);
            }
            break;
        case '多项填空':
            tag.push(`<div class="q_list_text" onclick="show_edit_menu(this);"><h2><em>${parseInt(question['num'])}.</em><span>${question['title'].join('').replace(/ /g, '&nbsp;').replace(/\n/g, '<br>')}`);
            if (question['is_required']) {
                tag.push('</span><em class="must">*</em></h2>');
            } else {
                tag.push('</span></h2>');
            }
            break;
        case '多级下拉':
            tag.push(`<div class="q_list_text" onclick="show_edit_menu(this);"><h2><em>${parseInt(question['num'])}.</em><span>${question['title']}</span>`);
            if (question['is_required']) {
                tag.push('<em class="must">*</em></h2><div class="ui-group-box" onclick="show_mpd(this);">多级下拉</div>');
            } else {
                tag.push('</h2><div class="ui-group-box" onclick="show_mpd(this);">多级下拉</div>');
            }
            break;
        case '矩阵单选':
            let titles = question['titles'], options = question['options'];
            tag.push(`<div class="q_list_text" onclick="show_edit_menu(this);"><h2><em>${parseInt(question['num'])}.</em><span>${question['title']}</span>`);
            if (question['is_required']) {
                tag.push('<em class="must">*</em></h2>');
            } else {
                tag.push('</h2>');
            }
            tag.push(`<table cellspacing="0" class="matrix-rating"><colgroup>`);
            for (let i = 0, len = options.length; i < len; i++) {
                tag.push(`<col width="${1 / len}%">`);
            }
            tag.push('</colgroup><tbody><tr class="trlabel">');
            for (let i = 0, len = options.length; i < len; i++) {
                if (options[i]['need_fill']) {
                    tag.push(`<th>${options[i]['text']}&nbsp;*</th>`);
                } else {
                    tag.push(`<th>${options[i]['text']}</th>`);
                }
            }
            tag.push('</tr>');
            for (let i = 0, len = titles.length; i < len; i++) {
                tag.push(`<tr><td style="text-align: left;" class="title">${titles[i]}</td></tr>`);
            }
            tag.push('</tbody></table>');
            break;
        case '日期':
            tag.push(`<div class="q_list_text" onclick="show_edit_menu(this);"><h2><em>${parseInt(question['num'])}.</em><span>${question['title']}</span>`);
            if (question['is_required']) {
                tag.push('<em class="must">*</em></h2><div class="ui-group-box">选择日期</div>');
            } else {
                tag.push('</h2><div class="ui-group-box">选择日期</div>');
            }
            break;
        case '文件':
            tag.push(`<div class="q_list_text" onclick="show_edit_menu(this);"><h2><em>${parseInt(question['num'])}.</em><span>${question['title']}</span>`);
            if (question['is_required']) {
                tag.push(`<em class="must">*</em></h2><div class="ui-group-box">选择文件（不超过${question['size'] / 1024}M，文件类型：${question['ext']}）</div>`);
            } else {
                tag.push(`</h2><div class="ui-group-box">选择文件（不超过${question['size'] / 1024}M，文件类型：${question['ext']}）</div>`);
            }
            break;
        default:
            break;
    }
    tag.push('<div class="text-dependent"><div class="text-relation">');
    let attach = question['attach'];
    if (attach) {
        tag.push('依赖于');
        for (let i = 0, len = attach.length; i < len; i++) {
            tag.push(`第${attach[i]['k'].replace('q', '')}题&nbsp;`);
        }
    }
    tag.push(`</div><div class="text-jump"></div><div class="text-refer"></div></div></div><div class="dropDownMenu" style="display: none;"><ul><li><span class="list_edit" onclick="show_question_editor(this);"><div class="list_editbg"></div><div class="list_word">编辑</div></span></li><li><span class="list_up" onclick="move_question(this, 'up');"><div class="list_upbg"></div><div class="list_word">上移</div></span></li><li><span class="list_down" onclick="move_question(this, 'down');"><div class="list_downbg"></div><div class="list_word">下移</div></span></li><li><span class="list_del" onclick="delete_question(this);"><div class="list_delbg"></div><div class="list_word">删除</div></span></li></ul></div>`);
    let question_tag = document.createElement('div');
    question_tag.id = `div${parseInt(question['num'])}`;
    question_tag.classList.add('q_list_li');
    question_tag.setAttribute('tabindex', '-1');
    question_tag.setAttribute('onblur', 'hide_edit_menu(this);');
    question_tag.innerHTML = tag.join('');
    let old_question_tag = question_list.querySelector(`#div${question['num']}`);
    if (old_question_tag) {
        old_question_tag.parentNode.removeChild(old_question_tag);
    }
    question_list.insertBefore(question_tag, question_list.querySelector(`#div${question['num'] + 1}`));
    if (scroll) {
        question_tag.scrollIntoView();
    }
}

function move_question(tag, direction) {
    let question_tag = tag.parentNode.parentNode.parentNode.parentNode;
    let num = parseInt(question_tag.id.replace('div', ''));
    if (direction === 'up') {
        if (num === 1) {
            return;
        }
        let pre_tag = question_tag.previousElementSibling;
        question_tag.id = `div${num - 1}`;
        question_tag.firstElementChild.firstElementChild.firstElementChild.innerHTML = `${num - 1}.`;
        pre_tag.id = `div${num}`;
        pre_tag.firstElementChild.firstElementChild.firstElementChild.innerHTML = `${num}.`;
        question_list.insertBefore(question_tag, pre_tag);
        questions[num - 1]['num']--;
        questions[num - 2]['num']++;
        questions[num - 1]['new'] = 1;
        questions[num - 2]['new'] = 1;
        let temp = questions[num - 2];
        questions[num - 2] = questions[num - 1];
        questions[num - 1] = temp;

    } else if (direction === 'down') {
        if (num === questions.length) {
            return;
        }
        let next_tag = question_tag.nextElementSibling;
        question_tag.id = `div${num + 1}`;
        question_tag.firstElementChild.firstElementChild.firstElementChild.innerHTML = `${num + 1}.`;
        next_tag.id = `div${num}`;
        next_tag.firstElementChild.firstElementChild.firstElementChild.innerHTML = `${num}.`;
        question_list.insertBefore(next_tag, question_tag);
        questions[num - 1]['num']++;
        questions[num]['num']--;
        questions[num - 1]['new'] = 1;
        questions[num]['new'] = 1;
        let temp = questions[num];
        questions[num] = questions[num - 1];
        questions[num - 1] = temp;
    }
}

function delete_question(tag) {
    let question_tag = tag.parentNode.parentNode.parentNode.parentNode;
    let num = parseInt(question_tag.id.replace('div', ''));
    let r = confirm(`确定删除第${num}题吗？`);
    if (r) {
        let next_tag = question_tag.nextElementSibling;
        question_tag.parentNode.removeChild(question_tag);
        while (next_tag) {
            let new_num = parseInt(next_tag.id.replace('div', '')) - 1;
            next_tag.id = `div${new_num}`;
            next_tag.firstElementChild.firstElementChild.firstElementChild.innerHTML = `${new_num}.`;
            next_tag = next_tag.nextElementSibling;
        }
        let question = questions.splice(num - 1, 1)[0];
        if (question['_id']) {
            abandoned_questions.push(question['_id']);
        }
        for (let i = num - 1, len = questions.length; i < len; i++) {
            questions[i]['num']--;
        }
    }
}

function show_question_editor(tag = null, type = null) {
    if (tag) {                                              //编辑已有的问题
        let num = parseInt(tag.parentNode.parentNode.parentNode.parentNode.id.replace('div', ''));
        curQuestion = questions[num - 1];
        type = curQuestion['type'];
    } else if (type) {                                      //编辑新的问题
        curQuestion['num'] = questions.length + 1;
        curQuestion['type'] = type;
    }
    curQuestion['survey_id'] = survey_id;
    let title = q_title.querySelector('textarea');
    switch (type) {                                         //根据题型初始化控件和数据
        case '单项选择':
        case '下拉单选':
            title.placeholder = '请输入标题';
            title.value = curQuestion['title'] ? curQuestion['title'] : '';
            q_options.style.display = '';
            let options = q_options.querySelector('textarea');
            options.placeholder = '请输入选项（每行一个）';
            options.value = curQuestion['options'] ? curQuestion['options'].join('\n') : '';
            break;
        case '单项填空':
            title.placeholder = '请输入标题';
            title.value = curQuestion['title'] ? curQuestion['title'] : '';
            q_rows.style.display = 'flex';
            q_rows.lastElementChild.value = curQuestion['rows'] ? `${curQuestion['rows']}` : '1';
            break;
        case '多项填空':
            title.placeholder = '请输入填空题内容，空格用下划线“_”表示';
            title.value = curQuestion['title'] ? curQuestion['title'].join('') : '';
            break;
        case '日期':
            title.placeholder = '请输入标题';
            title.value = curQuestion['title'] ? curQuestion['title'] : '';
            break;
        case '文件':
            title.placeholder = '请输入标题';
            title.value = curQuestion['title'] ? curQuestion['title'] : '';
            q_ext.style.display = '';
            q_size.style.display = 'flex';
            q_ext.querySelector('textarea').value = curQuestion['ext'] ? curQuestion['ext'].split('|').join('\n') : '';
            q_size.lastElementChild.value = curQuestion['size'] ? `${curQuestion['size']}` : '1024';
            break;
        case '矩阵单选':
            title.placeholder = '请输入标题';
            title.value = curQuestion['title'] ? curQuestion['title'] : '';
            q_titles.style.display = '';
            q_options.style.display = '';
            let m_options = q_options.querySelector('textarea');
            q_titles.querySelector('textarea').value = curQuestion['titles'] ? curQuestion['titles'].join('\n') : '';
            m_options.placeholder = '请输入选项（每行一个。若选项需要填空，在其末尾加上星号（*）即可，例：“选项1*”）';
            if (curQuestion['options']) {
                let text = [];
                let temp;
                for (let i = 0, options = curQuestion['options'], len = options.length; i < len; i++) {
                    temp = options[i]['need_fill'] ? `${options[i]['text']}*` : options[i]['text'];
                    text.push(temp);
                }
                m_options.value = text.join('\n');
            } else {
                m_options.value = '';
            }
            break;
        case '多级下拉':
            title.placeholder = '请输入标题';
            title.value = curQuestion['title'] ? curQuestion['title'] : '';
            q_layers.style.display = 'flex';
            let layers = q_layers.lastElementChild;
            layers.value = curQuestion['layers'] ? `${curQuestion['layers']}` : '2';
            js_fireEvent(layers, 'change');
            let layer_options = [];
            for (let i = 0, len = parseInt(layers.value); i < len; i++) {
                layer_options[i] = [];
            }
            if (curQuestion['options']) {
                for (let i = 0, options = curQuestion['options'], len = options.length; i < len; i++) {
                    layer_options[options[i]['layer_num'] - 1].push(options[i]);
                }
                let value = [];
                for (let i = 0, firstLayer = layer_options[0], len = firstLayer.length; i < len; i++) {
                    value.push(firstLayer[i]['content']);
                }
                widget_question_editor.querySelector('#q_layer_1 textarea').value = value.join('\n');
                let p_index;
                let curLayer;
                let preLayer;
                for (let i = 1, len = layer_options.length; i < len; i++) {
                    value = [];
                    curLayer = layer_options[i];
                    preLayer = layer_options[i - 1];
                    for (let j = 0, len = preLayer.length; j < len; j++) {
                        value.push(`---${preLayer[j]['content']}`);
                        p_index = preLayer[j]['index'];
                        for (let k = 0, len = curLayer.length; k < len; k++) {
                            if (curLayer[k]['p_index'] === p_index) {
                                value.push(curLayer[k]['content']);
                            }
                        }
                    }
                    widget_question_editor.querySelector(`#q_layer_${i + 1} textarea`).value = value.join('\n');
                }
            }
            break;
        default:
            widget_type_selector.style.display = 'none';
            shadow.style.display = 'none';
            prevent_slide(false);
            alert('该题型尚未开放，敬请期待……');
            return;
    }
    if (curQuestion['is_required']) {
        change_slider_status(q_is_required);
    }
    if (curQuestion['attach']) {
        let text = ['依赖于'];
        for (let i = 0, attach = curQuestion['attach'], len = attach.length; i < len; i++) {
            text.push(`第${attach[i]['k'].replace('q', '')}题&nbsp;`);
        }
        text.push('&nbsp;&gt;');
        q_attach.lastElementChild.lastElementChild.innerHTML = text.join('');
        q_attach.lastElementChild.firstElementChild.value = JSON.stringify(curQuestion['attach']);
        q_attach.lastElementChild.firstElementChild.nextElementSibling.value = curQuestion['attach_type'] ? curQuestion['attach_type'] : '';
    }
    widget_question_editor.style.display = '';
    widget_type_selector.style.display = 'none';
    shadow.style.display = 'none';
    prevent_slide(false);
    content.style.height = '0px';
    widget_question_editor.scrollIntoView();
}

function change_layer_num(tag) {
    let old_value = tag.getAttribute('old_value');
    let value = tag.value;
    old_value = old_value ? parseInt(old_value) : 0;
    value = value ? parseInt(value) : 0;
    if (old_value < value) {
        let layer_option_tag = [];
        if (!old_value) {
            for (let i = old_value, tag; i < value; i++) {
                widget_question_editor.insertBefore(generate_layer_option_tag(i + 1), q_setting);
            }
            tag.setAttribute('old_value', value);
            return;
        }
        for (let i = old_value, new_tag; i < value; i++) {
            new_tag = generate_layer_option_tag(i + 1);
            layer_option_tag.push(new_tag);
            widget_question_editor.insertBefore(new_tag, q_setting);
        }
        // widget_question_editor.querySelector(`#q_layer_${old_value} textarea`).blur();
        js_fireEvent(widget_question_editor.querySelector(`#q_layer_${old_value} textarea`), 'blur');
        for (let i = 0; i < value - old_value - 1; i++) {
            // layer_option_tag[i].querySelector('textarea').blur();
            js_fireEvent(layer_option_tag[i].querySelector('textarea'), 'blur');
        }
    } else {
        let temp;
        for (let i = value; i < old_value; i++) {
            temp = widget_question_editor.querySelector(`#q_layer_${i + 1}`);
            temp.parentNode.removeChild(temp);
        }
    }
    tag.setAttribute('old_value', value);
}

function generate_layer_option_tag(layer_num) {
    let el = document.createElement('div');
    el.id = `q_layer_${layer_num}`;
    el.setAttribute('style', 'padding-bottom: 20px;');
    el.innerHTML = `<div style="font-size: 12px; padding: 0 20px; color: #ABAFB2"><div style="line-height: 28px;"><span class="bt_req">*</span><span>${layer_num}级选项</span></div></div><div class="page__content"><div class="mod__title"><div class="mod__input"><textarea placeholder="请输入${layer_num}级选项（每行一个）" onblur="format_layer_options(this, ${layer_num})"></textarea></div></div></div><div class="errorMessage"></div>`;
    return el;
}

function format_layer_options(tag, layer_num) {
    let next_layer_tag = widget_question_editor.querySelector(`#q_layer_${layer_num + 1} textarea`);
    if (layer_num === 1) {
        let curOptions = Array.from(new Set(tag.value.trim().split(/\s+/)));
        if (!curOptions[0]) {
            let index = 3;
            do {
                next_layer_tag.value = '';
                next_layer_tag = widget_question_editor.querySelector(`#q_layer_${index++} textarea`);
            } while (next_layer_tag);
            return;
        }
        let formatted_nextOptions = [];
        for (let i = 0, len = curOptions.length, index = 1; i < len; i++) {
            formatted_nextOptions.push(`---${curOptions[i]}\n2级选项${index++}\n2级选项${index++}`);
        }
        tag.value = curOptions.join('\n');
        next_layer_tag.value = formatted_nextOptions.join('\n');
        js_fireEvent(next_layer_tag, 'blur');
        return;
    }
    let curOptions = tag.value.trim().split(/\n+/);
    if (!curOptions[0]) {
        let preLayer = widget_question_editor.querySelector(`#q_layer_${layer_num - 1} textarea`);
        js_fireEvent(preLayer, 'blur');
        return;
    }
    let groups = [];
    for (let i = 0, len = curOptions.length, index = -1; i < len; i++) {
        if (curOptions[i].startsWith('---')) {
            groups[++index] = [];
        } else if (!curOptions[i] || curOptions[i].match(/ +/)) {
            continue;
        }
        groups[index].push(curOptions[i]);
    }
    let formatted_curOptions = [];
    let formatted_nextOptions = [];
    for (let i = 0, len = groups.length, index = 1; i < len; i++) {
        groups[i] = Array.from(new Set(groups[i]));
        for (let j = 0, temp = groups[i], len = temp.length; j < len; j++) {
            formatted_curOptions.push(temp[j]);
            if (next_layer_tag && !temp[j].startsWith('---')) {
                formatted_nextOptions.push(`---${temp[j]}\n${layer_num + 1}级选项${index++}\n${layer_num + 1}级选项${index++}`);
            }
        }
    }
    tag.value = formatted_curOptions.join('\n');
    if (next_layer_tag) {
        next_layer_tag.value = formatted_nextOptions.join('\n');
        js_fireEvent(next_layer_tag, 'blur');
    }
}

function change_slider_status(tag) {
    if (tag.classList.contains('off')) {
        tag.classList.remove('off');
        tag.classList.add('on');
    } else if (tag.classList.contains('on')) {
        tag.classList.remove('on');
        tag.classList.add('off');
    }
}

function show_logic_setting(tag) {
    tag.style.display = 'none';
    tag.nextElementSibling.style.display = '';
}

function show_attach_editor(tag) {
    widget_question_editor.style.height = '0px';
    widget_attach_editor.style.display = '';
    let attach = tag.firstElementChild.value;
    if (attach) {
        attach = JSON.parse(attach);
        let text = [];
        for (let i = 0, len = attach.length; i < len; i++) {
            text.push(`${attach[i]['k'].replace('q', '')}:${attach[i]['v']}`);
        }
        widget_attach_editor.querySelector('textarea').value = text.join('\n');
    } else {
        widget_attach_editor.querySelector('textarea').value = '';
    }
    widget_attach_editor.querySelector('select').value = tag.firstElementChild.nextElementSibling.value;
}

function hide_attach_editor(cancel = false) {
    let textarea_tag = widget_attach_editor.querySelector('textarea');
    let select_tag = widget_attach_editor.querySelector('select');
    if (cancel) {
        textarea_tag.value = '';
        select_tag.value = '';
        widget_attach_editor.style.display = 'none';
        widget_question_editor.style.height = '';
        return;
    }
    let attach_text = Array.from(new Set(textarea_tag.value.trim().split(/\s+/)));
    let attach;
    if (!attach_text[0]) {
        attach = '';
    } else {
        attach = [];
        for (let i = 0, len = attach_text.length, text; i < len; i++) {
            text = attach_text[i].split(':');
            attach.push({'k': `q${text[0]}`, 'v': text[1]});
        }
    }
    if (attach) {
        let text = ['依赖于'];
        for (let i = 0, len = attach.length; i < len; i++) {
            text.push(`第${attach[i]['k'].replace('q', '')}题&nbsp;`);
        }
        text.push('&nbsp;&gt;');
        q_attach.lastElementChild.lastElementChild.innerHTML = text.join('');
    } else {
        q_attach.lastElementChild.lastElementChild.innerHTML = '未设置&nbsp;&gt;';
    }
    q_attach.lastElementChild.firstElementChild.value = JSON.stringify(attach);
    q_attach.lastElementChild.firstElementChild.nextElementSibling.value = select_tag.value;
    textarea_tag.value = '';
    select_tag.value = '';
    widget_attach_editor.style.display = 'none';
    widget_question_editor.style.height = '';
}

function hide_question_editor(cancel = false) {
    if (cancel) {
        switch (curQuestion['type']) {
            case '单项选择':
            case '下拉单选':
                q_options.style.display = 'none';
                break;
            case '单项填空':
                q_rows.style.display = 'none';
                break;
            case '文件':
                q_ext.style.display = 'none';
                q_size.style.display = 'none';
                break;
            case '矩阵单选':
                q_titles.style.display = 'none';
                q_options.style.display = 'none';
                break;
            case '多级下拉':
                let layers = q_layers.lastElementChild;
                layers.value = 0;
                js_fireEvent(layers, 'change');
                q_layers.style.display = 'none';
                break;
        }
        let attach_span = q_attach.lastElementChild.lastElementChild;
        if (!attach_span.innerHTML.startsWith('未设置')) {
            attach_span.innerHTML = '未设置&nbsp;&gt;';
            q_attach.lastElementChild.firstElementChild.value = '';
            q_attach.lastElementChild.firstElementChild.nextElementSibling.value = '';
        }
        if (q_is_required.classList.contains('on')) {           //重置is_required、attach控件的状态
            change_slider_status(q_is_required);
        }
        widget_question_editor.style.display = 'none';          //隐藏问题编辑器
        content.style.height = '';
        if (curQuestion['num']) {
            document.getElementById(`div${parseInt(curQuestion['num'])}`).scrollIntoView();
        }
        curQuestion = {};                                       //清空当前问题
        return;
    }
    let title = q_title.querySelector('textarea').value;
    if (!title) {
        q_title.lastElementChild.innerHTML = '请填写标题！';
        return;
    } else {
        q_title.lastElementChild.innerHTML = '';
    }
    switch (curQuestion['type']) {                          //构造问题
        case '单项选择':
        case '下拉单选':
            let options = q_options.querySelector('textarea').value.trim();
            if (!options) {
                q_options.lastElementChild.innerHTML = '请填写选项！';
                return;
            } else {
                q_options.lastElementChild.innerHTML = '';
            }
            options = Array.from(new Set(options.split(/\s+/)));
            if (options.length === 1) {
                q_options.lastElementChild.innerHTML = '至少设置2个选项！';
                return;
            } else {
                q_options.lastElementChild.innerHTML = '';
            }
            curQuestion['title'] = title;
            curQuestion['options'] = options;
            q_options.style.display = 'none';               //隐藏options控件
            break;
        case '单项填空':
            curQuestion['title'] = title;
            curQuestion['rows'] = parseInt(q_rows.lastElementChild.value);
            q_rows.style.display = 'none';                  //隐藏rows控件
            break;
        case '多项填空':
            let blanks = title.match(/_+/g);
            if (!blanks) {
                q_title.lastElementChild.innerHTML = '至少设置1个填空！';
                return;
            } else {
                q_title.lastElementChild.innerHTML = '';
            }
            let content = [];
            for (let i = 0, len = blanks.length; i < len; i++) {
                let index = title.indexOf(blanks[i]);       //下划线的索引
                content.push(title.substring(0, index), blanks[i]);
                title = title.substring(index + blanks[i].length)
            }
            curQuestion['title'] = content;
            break;
        case '日期':
            curQuestion['title'] = title;
            break;
        case '文件':
            let ext = q_ext.querySelector('textarea').value.trim();
            if (!ext) {
                q_ext.lastElementChild.innerHTML = '请填写文件类型！';
                return;
            } else {
                q_ext.lastElementChild.innerHTML = '';
            }
            curQuestion['title'] = title;
            curQuestion['ext'] = Array.from(new Set(ext.split(/\s+/))).join('|');
            curQuestion['size'] = parseInt(q_size.lastElementChild.value);
            q_ext.style.display = 'none';
            q_size.style.display = 'none';
            break;
        case '矩阵单选':
            let titles = q_titles.querySelector('textarea').value.trim();
            let m_options = q_options.querySelector('textarea').value.trim();
            if (!titles) {
                q_titles.lastElementChild.innerHTML = '请填写选项！';
                return;
            } else {
                q_titles.lastElementChild.innerHTML = '';
            }
            if (!m_options) {
                q_options.lastElementChild.innerHTML = '请填写选项！';
                return;
            } else {
                q_options.lastElementChild.innerHTML = '';
            }
            titles = Array.from(new Set(titles.split(/\s+/)));
            if (titles.length === 1) {
                q_titles.lastElementChild.innerHTML = '至少设置2个问题！';
                return;
            } else {
                q_titles.lastElementChild.innerHTML = '';
            }
            m_options = Array.from(new Set(m_options.split(/\s+/)));
            if (m_options.length === 1) {
                q_options.lastElementChild.innerHTML = '至少设置2个选项！';
            } else {
                q_options.lastElementChild.innerHTML = '';
            }
            let temp = [];
            for (let i = 0, len = m_options.length; i < len; i++) {
                if (m_options[i].endsWith('*')) {
                    temp.push({'text': m_options[i].slice(0, -1), 'need_fill': 1});
                } else {
                    temp.push({'text': m_options[i], 'need_fill': 0});
                }
            }
            curQuestion['title'] = title;
            curQuestion['titles'] = titles;
            curQuestion['options'] = temp;
            q_titles.style.display = 'none';
            q_options.style.display = 'none';
            break;
        case '多级下拉':
            let layers = q_layers.lastElementChild;
            let layer_num = parseInt(layers.value);
            let layer_option_tags = [];
            for (let i = 0; i < layer_num; i++) {
                layer_option_tags.push(widget_question_editor.querySelector(`#q_layer_${i + 1}`));
            }
            let firstLayer = Array.from(new Set(layer_option_tags[0].querySelector('textarea').value.trim().split(/\s+/)));
            if (!firstLayer[0]) {
                layer_option_tags[0].lastElementChild.innerHTML = '请填写1级选项！';
                return;
            } else {
                layer_option_tags[0].lastElementChild.innerHTML = '';
            }
            let layer_options = [];
            for (let i = 0; i < layer_num; i++) {
                layer_options[i] = [];
            }
            for (let i = 0, len = firstLayer.length; i < len; i++) {
                layer_options[0].push({'content': firstLayer[i], 'layer_num': 1, 'index': i + 1, 'p_index': 0});
            }
            let preLayer;
            let curLayer;
            let groups;
            for (let i = 1; i < layer_num; i++) {
                preLayer = layer_options[i - 1];
                curLayer = layer_option_tags[i].querySelector('textarea').value.trim().split(/\n+/);
                if (!curLayer[0]) {
                    layer_option_tags[i].lastElementChild.innerHTML = `请填写${i + 1}级选项！`;
                    return;
                } else {
                    layer_option_tags[i].lastElementChild.innerHTML = '';
                }
                groups = [];
                for (let j = 0, len = curLayer.length, p_index = -1; j < len; j++) {
                    if (curLayer[j].startsWith('---')) {
                        p_index++;
                        groups[p_index] = [];
                    } else {
                        if (curLayer[j].match(/ +/)) {
                            continue;
                        }
                        groups[p_index].push(curLayer[j]);
                    }
                }
                curLayer = [];
                for (let k = 0, len = groups.length, index = 1; k < len; k++) {
                    groups[k] = Array.from(new Set(groups[k]));
                    for (let m = 0, temp = groups[k], len = temp.length; m < len; m++) {
                        curLayer.push({'content': temp[m], 'layer_num': i + 1, 'index': index++, 'p_index': k + 1});
                    }
                }
                layer_options[i] = curLayer;
            }
            let final_options = layer_options[0].concat(layer_options[1]);
            for (let i = 2; i < layer_num; i++) {
                final_options = final_options.concat(layer_options[i]);
            }
            curQuestion['title'] = title;
            curQuestion['layers'] = layer_num;
            curQuestion['options'] = final_options;
            layers.value = 0;
            js_fireEvent(layers, 'change');
            q_layers.style.display = 'none';
            break;
        default:
            break;
    }
    curQuestion['is_required'] = q_is_required.classList.contains('on') ? 1 : 0;
    let attach_span = q_attach.lastElementChild.lastElementChild;
    if (!attach_span.innerHTML.startsWith('未设置')) {
        let attach_input = q_attach.lastElementChild.firstElementChild;
        let attach_type_input = q_attach.lastElementChild.firstElementChild.nextElementSibling;
        curQuestion['attach'] = JSON.parse(attach_input.value);
        let attach_type = attach_type_input.value;
        if (attach_type) {
            curQuestion['attach_type'] = attach_type;
        }
        attach_span.innerHTML = '未设置&nbsp;&gt;';
        attach_input.value = '';
        attach_type_input.value = '';
    }
    // else {
    //     curQuestion['attach'] = undefined;
    //     curQuestion['attach_type'] = undefined;
    // }
    curQuestion['new'] = 1;                                 //代表此问题经过编辑，保存问卷的时候需要更新此问题。
    if (curQuestion['num'] > questions.length) {            //将问题添加到问题数组中
        questions.push(curQuestion);
    } else {
        questions[curQuestion['num'] - 1] = curQuestion;
    }
    if (q_is_required.classList.contains('on')) {           //重置is_required、attach控件的状态
        change_slider_status(q_is_required);
    }
    widget_question_editor.style.display = 'none';          //隐藏问题编辑器
    content.style.height = '';
    render_question(curQuestion, true);                     //渲染问题
    curQuestion = {};                                       //清空当前问题
}

function hide_widget(tag) {
    tag.parentNode.parentNode.style.display = 'none';
    shadow.style.display = 'none';
    prevent_slide(false);
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