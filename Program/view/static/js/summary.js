let shadow = document.getElementById('shadow');
let widgets = {};
let condition_div = $('#divCondition');
let result_table = $('#resultTable tbody');
let selectBox = condition_div.find('select.condition_k');
let condition = {'survey_id': survey_id};
let condition_model;
let page_num = $('#page');
let total_page = $('#total_page');
let count_per_page = 3;
let questions;
const xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
xhr.responseType = 'json';
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
    let html = condition_div[0].querySelector('div.condition-cont').outerHTML;
    condition_model = html.substring(html.indexOf('</select>') + 9);
    shadow.style.height = `${screen.height}px`;
    widgets['mpd'] = document.getElementById('mpdDiv');
    widgets['surveyView'] = document.getElementById('surveyView');
    questions = widgets['surveyView'].querySelectorAll('[id^="q"]');
    widgets['mpd'].style.width = '370px';
    widgets['mpd'].style.height = '380px';
    widgets['mpd'].style.left = `${document.body.clientWidth / 2 - 370 / 2}px`;
}

function jump(survey_id) {
    location.replace(`/summary?id=${survey_id}`);
}

function addCondition() {
    condition_div.append(`<div class="condition-cont">${selectBox.prop('outerHTML')}${condition_model}`);
}

function delCondition(tag) {
    let cont = $(tag).closest('div.condition-cont');
    let option = cont.find('select.condition_k').val();
    if (option) {
        selectBox.find('[value="' + option + '"]').show();
        changeConditionList();
    }
    cont.remove();
}

function changeCondition(tag) {
    if (tag.pre_value) {
        selectBox.find(`[value="${tag.pre_value}"]`).show();
    }
    let new_option = selectBox.find(`[value="${tag.value}"]`);
    new_option.hide();
    changeConditionList();
    tag['pre_value'] = tag.value;
    tag['q_type'] = new_option.attr('type');
    let operator = tag.nextElementSibling;
    let v = operator.nextElementSibling;
    clearOperator(operator);
    switch (new_option.attr('type')) {
        case 'submit_time':
        case '日期':
            operator.querySelector('[value="between"]').style.display = '';
            let date_tag = v.querySelector(`[name="v${tag.value}"]`);
            operator.onchange = function () {
                switch (operator.value) {
                    case 'between':
                        date_tag.style.display = '';
                        break;
                    default:
                        date_tag.style.display = 'none';
                        break;
                }
            };
            break;
        case '多级下拉':
            operator.querySelector('[value="e"]').style.display = '';
            // operator.querySelector('[value="ne"]').style.display = '';
            operator.querySelector('[value="regex"]').style.display = '';
            let mpd_tag = v.querySelector(`[name="v${tag.value}"]`);
            operator.onchange = function () {
                switch (operator.value) {
                    case 'e':
                    case 'regex':
                        mpd_tag.style.display = '';
                        break;
                    default:
                        mpd_tag.style.display = 'none';
                        break;
                }
            };
            break;
        case '矩阵单选':
            operator.querySelector('[value="pregex"]').style.display = '';
            operator.querySelector('[value="in"]').style.display = '';
            let matrix_span_tag = v.querySelector(`span[name="v${tag.value.substring(0, tag.value.indexOf('_'))}"]`);
            let matrix_select_tag = v.querySelector(`select[name="v${tag.value.substring(0, tag.value.indexOf('_'))}"]`);
            operator.onchange = function () {
                switch (operator.value) {
                    case 'pregex':
                        matrix_span_tag.style.display = 'none';
                        matrix_select_tag.style.display = '';
                        break;
                    case 'in':
                        matrix_select_tag.style.display = 'none';
                        matrix_span_tag.style.display = '';
                        break;
                    default:
                        matrix_select_tag.style.display = 'none';
                        matrix_span_tag.style.display = 'none';
                }
            };
            break;
        case '下拉单选':
        case '单项选择':
            operator.querySelector('[value="e"]').style.display = '';
            operator.querySelector('[value="ne"]').style.display = '';
            operator.querySelector('[value="in"]').style.display = '';
            let span_tag = v.querySelector(`span[name="v${tag.value}"]`);
            let select_tag = v.querySelector(`select[name="v${tag.value}"]`);
            operator.onchange = function () {
                switch (operator.value) {
                    case 'e':
                    case 'ne':
                        span_tag.style.display = 'none';
                        select_tag.style.display = '';
                        break;
                    case 'in':
                        select_tag.style.display = 'none';
                        span_tag.style.display = '';
                        break;
                    default:
                        select_tag.style.display = 'none';
                        span_tag.style.display = 'none';
                }
            };
            break;
        default:
            operator.querySelector('[value="e"]').style.display = '';
            operator.querySelector('[value="ne"]').style.display = '';
            operator.querySelector('[value="regex"]').style.display = '';
            let input_tag = v.querySelector('[name="v0"]');
            operator.onchange = function () {
                switch (operator.value) {
                    case 'e':
                    case 'ne':
                    case 'regex':
                        input_tag.style.display = '';
                        break;
                    default:
                        input_tag.style.display = 'none';
                        input_tag.value = '';
                        break;
                }
            };
            break;
    }
    if (new_option.attr('is_required') === '0') {
        operator.querySelector('[value="exists"]').style.display = '';
        operator.querySelector('[value="nexists"]').style.display = '';
    }
}

function changeConditionList() {
    condition_div.find('select.condition_k').each(function () {
        let that = $(this);
        let v = that.val();
        this.innerHTML = selectBox.html();
        that.val(v);
    });
}

function clearOperator(tag) {
    for (let i = 0, len = tag.length; i < len; i++) {
        tag[i].style.display = 'none';
    }
    tag.value = '';
    $(tag).change();
    tag.onchange = null;
}

function query() {
    let condition_bak = condition;
    condition = {'survey_id': survey_id};
    condition_div.find('div').each(function () {
        let k = this.firstElementChild;                     //题号（条件），例："7_1"
        let o = k.nextElementSibling.value;                 //操作符
        let v = k.nextElementSibling.nextElementSibling;    //题号对应的值
        let value;
        if (o === 'exists') {
            value = {'$exists': true};
        } else if (o === 'nexists') {
            value = {'$exists': false};
        } else {
            let tag;
            switch (k['q_type']) {         //按照题型、操作符等条件构造v
                case 'submit_time':
                case '日期':
                    tag = v.querySelector(`[name="v${k.value}"]`);
                    let beginDate = tag.firstElementChild.value;
                    let endDate = tag.lastElementChild.value;
                    if (beginDate && endDate) {
                        value = {'$gte': 'date_' + beginDate, '$lte': 'date_' + endDate};
                    } else if (beginDate) {
                        value = {'$gte': 'date_' + beginDate};
                    } else if (endDate) {
                        value = {'$lte': 'date_' + endDate};
                    } else {
                        delCondition(k);
                        return;
                    }
                    break;
                case '多级下拉':
                    tag = v.querySelector(`[name="v${k.value}"]`);
                    if (!tag.value) {
                        delCondition(k);
                        return;
                    }
                    switch (o) {
                        case 'e':
                            value = tag.value;
                            break;
                        case 'regex':
                            value = 'regex_' + tag.value;
                            break;
                    }
                    break;
                case '下拉单选':
                case '单项选择':
                    if (o === 'e') {
                        tag = v.querySelector(`select[name="v${k.value}"]`);
                        if (!tag.value) {
                            delCondition(k);
                        }
                        value = tag.value;
                    } else if (o === 'ne') {
                        tag = v.querySelector(`select[name="v${k.value}"]`);
                        if (!tag.value) {
                            delCondition(k);
                        }
                        value = {'$ne': tag.value};
                    } else if (o === 'in') {
                        let li = [];
                        tag = v.querySelector(`span[name="v${k.value}"]`).querySelectorAll('input');
                        for (let i = 0, len = tag.length; i < len; i++) {
                            if (tag[i].checked) {
                                li.push(tag[i].value);
                            }
                        }
                        if (li.length === 0) {
                            delCondition(k);
                            return;
                        }
                        value = {'$in': li};
                    }
                    break;
                case '矩阵单选':
                    if (o === 'pregex') {
                        tag = v.querySelector(`select[name="v${k.value.substring(0, k.value.indexOf('_'))}"]`);
                        if (!tag.value) {
                            delCondition(k);
                        }
                        value = 'regex_^' + tag.value;
                    } else if (o === 'in') {
                        let li = [];
                        tag = v.querySelector(`span[name="v${k.value.substring(0, k.value.indexOf('_'))}"]`).querySelectorAll('input');
                        for (let i = 0, len = tag.length; i < len; i++) {
                            if (tag[i].checked) {
                                li.push('regex_^' + tag[i].value);
                            }
                        }
                        if (li.length === 0) {
                            delCondition(k);
                            return;
                        }
                        value = {'$in': li};
                    }
                    break;
                default:
                    tag = v.querySelector('[name="v0"]');
                    if (!tag.value) {
                        delCondition(k);
                        return;
                    }
                    switch (o) {
                        case 'e':
                            value = tag.value;
                            break;
                        case 'ne':
                            value = {'$ne': tag.value};
                            break;
                        case 'regex':
                            value = 'regex_' + tag.value;
                            break;
                    }
                    break;
            }
        }
        condition[k.value] = value;       //将构造好的条件添加到condition中
    });
    if (!queryData(1)) {                   //如果查询失败，还原之前的查询条件，确保翻页功能有效
        condition = condition_bak;
    }
}

function queryData(page, count = count_per_page, replace = true) {
    condition['skip'] = (page - 1) * count;
    condition['limit'] = count;
    let callback = 1;
    console.log(condition);
    xhr.open('GET', `/answers?condition=${JSON.stringify(condition)}`);
    xhr.send();
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                let response = xhr.response;
                if (response['code'] === 1) {
                    let answers = response['data'];
                    let html = [];
                    if (replace) {
                        $('p.result-text').html(`筛选出<span id="filterNum">${response['filterNum']}</span>条/共<span id="totalNum">${response['dataNum']}</span>条`);
                        for (let i = 0, len = answers.length; i < len; i++) {
                            html.push(`<tr id="${answers[i]['_id']}"><td>${answers[i]['_id']}</td><td>${answers[i]['submit_time']}</td><td>${answers[i]['source']}</td><td><a onclick="showSurveyView('${answers[i]['_id']}');" title="查看答卷">查看</a>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a onclick="delAnswer(this);" title="删除答卷">删除</a></td></tr>`);
                        }
                        result_table.html(html.join(''));                        //替换查询结果
                        page_num.html(page);                            //更新页码
                        total_page.html(Math.ceil(response['filterNum'] / count));  //更新总页码
                    } else {
                        if (answers.length) {
                            for (let i = 0, len = answers.length; i < len; i++) {
                                html.push(`<tr id="${answers[i]['_id']}"><td>${answers[i]['_id']}</td><td>${answers[i]['submit_time']}</td><td>${answers[i]['source']}</td><td><a onclick="showSurveyView('${answers[i]['_id']}');" title="查看详情">查看</a>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a onclick="delAnswer(this);" title="删除答卷">删除</a></td></tr>`);
                            }
                        }
                        else {
                            html.push(`<tr id="${answers['_id']}"><td>${answers['_id']}</td><td>${answers['submit_time']}</td><td>${answers['source']}</td><td><a onclick="showSurveyView('${answers['_id']}');" title="查看详情">查看</a>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a onclick="delAnswer(this);" title="删除答卷">删除</a></td></tr>`);
                        }
                        result_table.append(html.join(''));                      //增加查询结果
                    }
                } else {
                    alert(`查询失败：${response['msg']}`);
                    callback = 0;
                }
            }
        }
    };
    return callback;
}

function download_xlsx() {
    window.open(`/answers?download=&condition=${JSON.stringify(condition)}`);
}

function delAnswer(tag) {
    let tr = tag.parentNode.parentNode;
    let r = confirm(`确定删除ID为：${tr.id}的答卷吗？`);
    if (r) {
        xhr.open('DELETE', `/answers?id=${tr.id}`);
        xhr.send();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    let response = xhr.response;
                    if (response['code'] === 1) {
                        queryData(parseInt(page_num.html()) * count_per_page, 1, false);
                        tr.parentNode.removeChild(tr);
                    } else {
                        alert(`删除答卷失败：${response['msg']}`);
                    }
                } else {
                    alert(`删除答卷失败：${xhr.status}`);
                }
            }
        }
    }
}

function prev_page(tag, toBegin = false) {
    let page = parseInt(page_num.html());
    if (page <= 1) {
        return;
    }
    if (toBegin) {
        queryData(1);
        return;
    }
    queryData(--page);
}

function next_page(tag, toEnd = false) {
    let page = parseInt(page_num.html());
    if (page >= parseInt(total_page.html())) {
        return;
    }
    if (toEnd) {
        queryData(parseInt(total_page.html()));
        return;
    }
    queryData(++page);
}

function changeDataCount(tag) {
    let first_answer = (parseInt(page_num.html()) - 1) * count_per_page + 1;
    count_per_page = parseInt(tag.value);
    queryData(parseInt(first_answer / count_per_page) + 1);
}

function changeSelectText(select_tag) {
    select_tag.parentNode.firstElementChild.innerHTML = select_tag.value;
}

function show_calender(tag) {
    let year, month, date;
    if (this.value) {
        let arr = this.value.split("-");
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
        onConfirm: function (result) {
            if (!result || result.length === 0) return;
            tag.value = result.join('-');
            if ('createEvent' in document) {
                let e = document.createEvent('HTMLEvents');
                e.initEvent('change', false, true);
                tag.dispatchEvent(e);
            } else {
                tag.fireEvent('onchange');
            }
        },
        id: "date_" + tag.name
    });
}

function check_date(tag) {
    let begin_date = tag.previousElementSibling.value;
    if (!begin_date) {
        return;
    }
    begin_date = new Date(begin_date);
    let end_time = new Date(tag.value);
    if (begin_date > end_time) {
        tag.value = '';
        alert('日期范围填写错误！');
    }
}

function showSurveyView(answer_id) {
    xhr.open('GET', `/answers?id=${answer_id}`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send();
    let answer;
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                let response = xhr.response;
                if (response.code === 1) {
                    answer = response['data'];
                    for (let i = 0, len = questions.length; i < len; i++) {
                        let text = answer[questions[i].id.replace('q_', '').replace('q', '')];
                        let question_div = widgets['surveyView'].querySelector(`#div${questions[i].id.substring(1, -1 === questions[i].id.indexOf('_') ? undefined : questions[i].id.indexOf('_'))}`);
                        if (text) {
                            if ('File' === questions[i].className) {
                                if (text.startsWith('img|')) {
                                    let img_info = text.split('|');
                                    let real_filename = img_info[1];
                                    let file_tag = questions[i].parentNode.nextElementSibling;
                                    questions[i].innerHTML = real_filename.substring(real_filename.indexOf('_', real_filename.indexOf('_') + 1) + 1);
                                    file_tag.href = `/files?filename=${real_filename}&survey_id=${answer['survey_id']}`;
                                    file_tag.firstElementChild.innerHTML = `<img src="data:image/webp;base64,${img_info[2]}">`;
                                } else {
                                    let real_filename = text.split('|')[1];
                                    let file_tag = questions[i].parentNode.nextElementSibling;
                                    questions[i].innerHTML = real_filename.substring(real_filename.indexOf('_', real_filename.indexOf('_') + 1) + 1);
                                    file_tag.href = `/files?filename=${real_filename}&survey_id=${answer['survey_id']}`;
                                    file_tag.firstElementChild.innerHTML= '';
                                }
                            } else {
                                questions[i].innerHTML = text;
                            }
                            question_div.style.display = '';
                        } else {
                            questions[i].innerHTML = '';
                            question_div.style.display = 'none';
                        }
                    }
                    let scrollTop = document.documentElement.scrollTop || window.pageYOffset || document.body.scrollTop;
                    shadow.style.top = `${scrollTop}px`;
                    widgets['surveyView'].style.top = `${screen.height * 0.1 + scrollTop}px`;
                    shadow.style.display = '';
                    widgets['surveyView'].style.display = '';
                    // widgets['surveyView'].querySelector('div').scrollIntoView();
                } else {
                    alert(`查询答卷失败：${response.msg}`);
                }
            } else {
                alert(`查询答卷失败：${xhr.status}`);
            }
        }
    };
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
        for (let i = 0, len = selects.length; i < len; i++) {
            if ('请选择' !== selects[i].value) {
                resultArray.push(selects[i].value);
            }
        }
        tag.value = resultArray.join('-');
        if ('createEvent' in document) {
            let e = document.createEvent('HTMLEvents');
            e.initEvent('change', false, true);
            tag.dispatchEvent(e);
        } else {
            tag.fireEvent('onchange');
        }
        widgets['mpd'].style.display = 'none';
        shadow.style.display = 'none';
    };
    shadow.style.display = '';
    let scrollTop = document.documentElement.scrollTop || window.pageYOffset || document.body.scrollTop;
    widgets['mpd'].style.top = `${document.body.clientHeight / 2 - 380 / 2 + scrollTop}px`;
    widgets['mpd'].style.display = '';
}

function closeWidget(tag) {
    if (shadow === tag) {
        Object.keys(widgets).forEach(function (key) {
            widgets[key].style.display = 'none';
        });
    } else {
        tag.parentElement.parentElement.style.display = 'none';
    }
    shadow.style.display = 'none';
}

function dataUrl2File(dataUrl) {
    let arr = dataUrl.split(','), info = arr[0], bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], info.substring(0, info.indexOf('/')), {type: info.match(/:(.*?);/)[1]});
}