
if (typeof Poly9 == 'undefined')
{
    var Poly9 = {};
}
Poly9.URLParser = function(url) {

    this._fields = {
        'Username' : 4,
        'Password' : 5,
        'Port' : 7,
        'Protocol' : 2,
        'Host' : 6,
        'Pathname' : 8,
        'URL' : 0,
        'Querystring' : 9,
        'Fragment' : 10
    };

    this._values = {};
    this._regex = null;
    this.version = 0.1;
    this._regex = /^((\w+):\/\/)?((\w+):?(\w+)?@)?([^\/\?:]+):?(\d+)?(\/?[^\?#]+)?\??([^#]+)?#?(\w*)/;
    for(var f in this._fields)
    {
        this['get' + f] = this._makeGetter(f);
    }

    if (typeof url != 'undefined')
    {
        this._parse(url);
    }
}

Poly9.URLParser.prototype.setURL = function(url) {
    this._parse(url);
}

Poly9.URLParser.prototype._initValues = function() {
    for(var f in this._fields)
    {
        this._values[f] = '';
    }
}

Poly9.URLParser.prototype._parse = function(url) {
    this._initValues();
    var r = this._regex.exec(url);
    if (!r) throw 'DPURLParser::_parse -> Invalid URL';

    for(var f in this._fields) if (typeof r[this._fields[f]] != 'undefined')
    {
        this._values[f] = r[this._fields[f]];
    }
}

Poly9.URLParser.prototype._makeGetter = function(field) {
    return function() {
        return this._values[field];
    }
}



function read(d){
    var p=/^(https?|ftp|file):\/\/[-A-Za-z0-9+&@#\/%?=~_|!:,.;]*[-A-Za-z0-9+&@#\/%=~_|]$/;
    if(p.test(d)){
        chrome.tabs.create({url:d});
    }else{
        msg(d);
    }
}
/**
 * 复制到剪贴板（现代 API + 降级方案）
 * @param {string} str - 要复制的文本
 * @returns {Promise<boolean>} - 是否复制成功
 */
async function copyToClipboard(str) {
    if (!str) return false;
    
    // 优先使用现代 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(str);
            return true;
        } catch (err) {
            console.warn('[copyToClipboard] Clipboard API 失败，尝试降级方案:', err);
        }
    }
    
    // 降级方案：创建临时 textarea 元素
    if (typeof document !== 'undefined') {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = str;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        } catch (err) {
            console.error('[copyToClipboard] 降级方案也失败:', err);
        }
    }
    
    return false;
}

/**
 * 二维码识别结果处理（MV3 兼容）
 * @param {string} v - 识别结果
 */
function msg(v) {
    if (v === "error decoding QR Code") {
        // MV3 Worker 中没有 alert，使用 console 输出
        console.log("[msg] 无法识别二维码");
        return;
    }
    
    // 显示确认对话框，确认后复制到剪贴板
    if (typeof document !== 'undefined' && typeof confirm !== 'undefined') {
        const r = confirm("二维码识别结果如下(确定将复制到剪贴板):" + '\n\n' + v);
        if (r === true) {
            copyToClipboard(v);
        }
    } else {
        // 在 Worker 中，仅输出到 console
        console.log("[msg] 二维码识别结果:", v);
    }
}


function deQrcode(info){
    var url=info.srcUrl;
    qrcode.decode(url);
    qrcode.callback = read;
};

function deQrcode2(){
    return function(info,tab){
        var url=info.srcUrl;
        qrcode.decode(url);
        qrcode.callback = read;
    };
};

Date.prototype.format = function(format) {
    var o = {
        "M+" : this.getMonth() + 1, // month
        "d+" : this.getDate(), // day
        "h+" : this.getHours(), // hour
        "m+" : this.getMinutes(), // minute
        "s+" : this.getSeconds(), // second
        "q+" : Math.floor((this.getMonth() + 3) / 3), // quarter
        "S" : this.getMilliseconds()
        // millisecond
    };
    if (/(y+)/.test(format))
        format = format.replace(RegExp.$1, (this.getFullYear() + "")
            .substr(4 - RegExp.$1.length));
    for ( var k in o)
        if (new RegExp("(" + k + ")").test(format))
            format = format.replace(RegExp.$1, RegExp.$1.length == 1 ? o[k]
                : ("00" + o[k]).substr(("" + o[k]).length));
    return format;
}

function format()
{
    var a = [].slice.apply( arguments ), s = a.shift();
    return s.replace( /\{[0-9]+\}/g, function( d ){ return a[ d.slice( 1, -1 ) ]; } );
}