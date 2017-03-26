var hintNumStr = '';
var hintElems = [];
var hintOpenInNewTab = false;
var hintEnabled = false;
var hintKeys = ";asdfghjkl"
var textInputs = ['textarea','date', 'datetime-local', 'email', 'file', 'month','number', 'password', 'search', 'tel', 'text', 'url', 'week'];
var allowFocus = [];
var blockElems = [];
var highlights = [];
var commandHistory = [':'];
var commandPointer = -1;
var findPointer = -1;
var bypassBlocker = false;
var zoomLevel = 1;
var eventListeners = {};
var oldAddEventListener = null;
var oldRemoveEventListener = null;
var allowPassthrough = false;
var passthroughEvents = [];
var clickableElems = [];

// Handle onwheel event
window.onwheel = function(e){window.scrollBy(0, -e.wheelDelta); return false; }

document.addEventListener('DOMContentLoaded', function(event) {
	var storedZoomLevel = localStorage.getItem('zoomLevel');

	//alert(storedZoomLevel);
	if(!isNaN(storedZoomLevel) && storedZoomLevel != null){
		zoomLevel = number(storedZoomLevel);
		document.body.style.zoom = zoomLevel;
	}

	// Create GUI
	createGui();

	// Unfocus active textbox
	unfocus();
});

document.addEventListener('keydown', initKeyBind, true, true);

// Intercept all calls to addEventListener or removeEventListener.
oldAddEventListener = HTMLElement.prototype.addEventListener;
oldRemoveEventListener = HTMLElement.prototype.removeEventListener;
HTMLElement.prototype.addEventListener = addEventListenerExt;
HTMLElement.prototype.removeEventListener = removeEventListenerExt;

function createGui(){
	var panel = document.getElementById('zsurf-panel');

	if(panel == null){
	var div = document.createElement('div');
		div.id = "zsurf-panel";
		div.style.cssText = [
			'right: 0px !important;',
			'left: 0px !important;',
			'bottom: 0px !important;',
			'height: 26px !important;',
			'position: fixed !important;',
			'color: white !important;',
			'background-color: #000000c6 !important;',
			'font-family: Arial, Helvetica, sans-serif !important;',
			'font-style: normal !important;',
			'font-size: 13px !important;',
			'font-weight: bold !important;',
			'border-top: 1px dashed gray !important;',
			'z-index: 2147483647 !important;',
			'margin: 0 !important;',
			'padding: 0 !important;',
		].join('');
	div.show = function(){	
		this.style.display = 'block';
	}
	div.hide = function(){this.style.display = 'none';}

	var input = document.createElement('input');
	input.id = "zsurf-console";
	input.type = "text";
	input.addEventListener('keydown', parseCommand, true, true);

	input.style.cssText = [ 
		'left: 0px !important;',
		'bottom: 0px !important;',
		'width: 100% !important;',
		'height: 26px !important;',
		'position: fixed !important;',
		'color: white !important;',
		'background-color: transparent !important;',
		'font-family: Arial, Helvetica, sans-serif !important;',
		'font-style: normal !important;',
		'font-size: 13px !important;',
		'font-weight: bold !important;',
		'outline: none !important;',
		'border: 0 !important;',
		'z-index: 2147483647 !important;',
		'margin: 0 !important;',
		'padding: 0 !important;',
	].join('');

	var span = document.createElement('span');
	span.id = "zsurf-location";
	span.innerHTML = window.location.href;
	span.style.cssText = [
		'right: 0px !important;',
		'bottom: 0px !important;',
		'height: 22px !important;',
		'position: fixed !important;',
		'color: lime !important;',
		'font-family: Arial, Helvetica, sans-serif !important;',
		'font-style: normal !important;',
		'font-size: 13px !important;',
		'font-weight: bold !important;',
		'outline: none !important;',
		'z-index: 2147483647 !important;',
		'margin: 0px 10px 0px 0px !important;',
		'padding: 0 !important;',
		'line-height: 18px !important;',
	].join('');

	div.appendChild(span);
	div.appendChild(input);

	document.body.appendChild(div);

	return div;
	} else {
		return panel;
	}
}

function addEventListenerExt(type, callback, capture){
	if(eventListeners[this] == undefined) {
		eventListeners[this] = [type];	
	} else {
		eventListeners[this].push(type);
	}

	
	if( (type != 'keydown' &&
		type != 'keyup' &&
		type != 'keypress') ||
		callback == parseCommand){
		if( type == 'click' ||
			type == 'dblclick' ||
			type == 'mouseenter' ||
			type == 'mouseleave' ||
			type == 'mouseover' ||
			type == 'mousedown' ||
			type == 'mousemove' ||
			type == 'mouseout' ||
			type == 'mouseup'){
			clickableElems.push(this);
		}

		return oldAddEventListener.apply(this, arguments);
	} else if(!allowPassthrough){
		
		passthroughEvents.push({
			"element" : this,
			"type" : type,
			"callback" : callback,
			"capture" : capture
		});
	}
}

function removeEventListenerExt(type, callback, capture){
	
	if(eventListeners[this] == undefined) {
		eventListeners[this] = [];	
	} else {
		var i = eventListeners[this].indexOf(type);
		if(i != -1) {
			eventListeners[this].splice(type, i);
		}
	}

	return oldRemoveEventListener.apply(this, arguments);
}

function togglePassthrough(){
	console.log("try to toggle passthrough");
	if(allowPassthrough){
		console.log("togglePassthrough Off");

		allowPassthrough = false;
		for(var i = 0; i < passthroughEvents.length; i++){
			passthroughEvents[i]['element'].removeEventListener(
				passthroughEvents[i]['type'],
				passthroughEvents[i]['callback'],
				passthroughEvents[i]['capture']);
		}
		document.removeEventListener('keydown', initKeyBind, false, false);
		
		setTimeout(function(){
			document.addEventListener('keydown', initKeyBind, true, true);
		}, 1000);
	} else {
		console.log("togglePassthrough On");

		allowPassthrough = true;
		for(var i = 0; i < passthroughEvents.length; i++){
			passthroughEvents[i]['element'].addEventListener(
				passthroughEvents[i]['type'],
				passthroughEvents[i]['callback'],
				passthroughEvents[i]['capture']);
		}
		document.removeEventListener('keydown', initKeyBind, true, true);

		setTimeout(function(){
		document.addEventListener('keydown', initKeyBind, false, false);
		}, 1000);
	}
}

function toString(num){
	var strNum = '';
	for (var i = 0; i < num.toString().length; i++) {
		strNum += hintKeys.charAt(Number(num.toString().charAt(i)));	
	}
	return strNum;
}

function toNumber(str){
	var numStr = '';
	for (var i = 0; i < str.length; i++) {
		numStr += hintKeys.indexOf(str.charAt(i));
	}
	return Number(numStr);
}

function simulate(el, etype){
  if (el.fireEvent) {
    el.fireEvent('on' + etype);
  } else {
    var evObj = document.createEvent('Events');
    evObj.initEvent(etype, true, false);
    el.dispatchEvent(evObj);
  }
}

function simulateScroll(delta) {
  var evt = document.createEvent("MouseEvents");
  evt.initEvent('mousewheel', true, true);
  evt.wheelDelta = delta;
  document.dispatchEvent(evt);
}

function hintMode(newtab){
    hintEnabled = true;
    if (newtab) {
        hintOpenInNewTab = true;
    } else {
        hintOpenInNewTab = false;
    }
    setHints();
    document.removeEventListener('keydown', initKeyBind, true);
    document.addEventListener('keydown', hintHandler, true);
    hintNumStr = '';
}

function hintHandler(e){
    var pressedKey = getKey(e);
    if (pressedKey == 'Enter') {
        if (hintNumStr == '')
            hintNumStr = '1';
        judgeHintNum(toNumber(hintNumStr));

    } else if (hintKeys.indexOf(pressedKey) == -1) {
        removeHints();
    } else {
        hintNumStr += pressedKey;
        var hintNum = toNumber(hintNumStr);
        if (hintNum * 10 > hintElems.length + 1) {
            judgeHintNum(hintNum);
        } else {
            var hintElem = hintElems[hintNum - 1];
			
            if (hintElem != undefined && hintElem.tagName.toLowerCase() == 'a') {
                setHighlight(hintElem, true);
            }
        }
    }
	e.preventDefault();
	e.stopPropagation();
	e.stopImmediatePropagation();
}

function setHighlight(elem, isActive) {
    if (isActive) {
        var activeElem = document.body.querySelector('a[highlight=hint_active]');
        if (activeElem != undefined)
            activeElem.setAttribute('highlight', 'hint_elem');
        elem.setAttribute('highlight', 'hint_active');
    } else {
        elem.setAttribute('highlight', 'hint_elem');
    }
}

function setHintRules() {
    var ss = document.styleSheets[0];
	if(ss != undefined) {
    	ss.insertRule('a[highlight=hint_elem] {background-color: yellow !important}', 0);
    	ss.insertRule('a[highlight=hint_active] {background-color: lime !important;}', 0);
	}
}

function deleteHintRules() {
    var ss = document.styleSheets[0];
	if(ss != undefined) {
    	ss.deleteRule(0);
    	ss.deleteRule(0);
	}
}

function judgeHintNum(hintNum) {
    var hintElem = hintElems[hintNum - 1];
    if (hintElem != undefined) {
        execSelect(hintElem);
    } else {
        removeHints();
    }
}

function execSelect(elem) {
    var tagName = elem.tagName.toLowerCase();
    var type = elem.type ? elem.type.toLowerCase() : "";
	bypassBlocker = true;
    if (tagName == 'a' && elem.href != '') {
        setHighlight(elem, true);
        if (hintOpenInNewTab) {
            window.open(elem.href);
		} else if(elem.href.indexOf('javascript:') == -1 &&
				elem.href.indexOf('#') == -1 &&
				elem.href.length != 0){
			location.href = elem.href;
		} else {
			console.log('click element');
			elem.click();
		}
    } else if (tagName == 'input' && (type == "submit" || type == "button" || type == "reset")) {
		elem.click();
    } else if (tagName == 'input' && (type == "radio" || type == "checkbox")) {
        elem.checked = !elem.checked;
    } else if (tagName == 'input' || tagName == 'textarea') {
		console.log("focus element");
		elem.focus();
		elem.click();
        elem.setSelectionRange(elem.value.length, elem.value.length);
    } else {
		elem.click();
	}
    removeHints();
}

function setHints() {
    setHintRules();
    var winTop = window.scrollY/zoomLevel;
    var winBottom = winTop + (window.innerHeight/zoomLevel);
    var winLeft = window.scrollX/zoomLevel;
    var winRight = winLeft + (window.innerWidth/zoomLevel);
	var lastElemLeft = 0;
	var lastElemTop = 0;
	var offset = 0;

	// Query elements which can be clicked
    var elems = document.body.querySelectorAll('a, input:not([type=hidden]), [data=events], [role=tab], [role=radio] , [role=option], [role=combobox], [role=checkbox], [role=button], textarea, select, button, [onclick], [onfocus], [data-ui-tracking-context]');

	// Add list of click elements we collected from event listeners
	elems = clickableElems.concat(Array.from(elems));

	// Remove duplicates
	elems = elems.filter(function(item, pos, self) {
    	return self.indexOf(item) == pos;
	})

    var div = document.createElement('div');
    div.setAttribute('highlight', 'hints');
    document.body.appendChild(div);
    for (var i = 0; i < elems.length; i++) {
        var elem = elems[i];
        if (!isHintDisplay(elem))
            continue;
        var pos = elem.getBoundingClientRect();
        var elemTop = winTop + pos.top;
        var elemBottom = winTop + pos.bottom;
        var elemLeft = winLeft + pos.left;
        var elemRight = winLeft + pos.left;
		if(elemLeft == lastElemLeft && elemTop ==lastElemTop){
			offset += 20;
			elemLeft += offset;
			elemTop += offset;
		} else {
			lastElemLeft = elemLeft;
			lastElemTop = elemTop;
			offset = 0;
		}
        if ( elemBottom >= winTop && elemTop <= winBottom) {
            hintElems.push(elem);
            setHighlight(elem, false);
            var hint = document.createElement('div');
            hint.style.cssText = [ 
                'left: ', elemLeft, 'px !important;',
                'top: ', elemTop, 'px !important;',
                'position: absolute !important;',
                'background-color: ' + (hintOpenInNewTab ? '#ff6600' : '#ff0000a0') + ' !important;',
				'border: 1px solid white !important;',
				'text-shadow: 1px 1px #000000 !important;',
                'color: white !important;',
				'font-family: Arial, Helvetica, sans-serif !important;',
				'font-style: normal !important;',
                'font-size: 16px !important;',
                'font-weight: bold !important;',
                'padding: 0px 1px !important;',
				'margin: 0px !important;',
                'z-index: 2147483647 !important;',
				'text-transform: uppercase !important;',
            ].join('');
            hint.innerHTML = toString(hintElems.length);
            div.appendChild(hint);
            if (elem.tagName.toLowerCase() == 'a') {
                if (hintElems.length == 1) {
                    setHighlight(elem, true);
                } else {
                    setHighlight(elem, false);
                }
            }
        }
    }
}

function isHintDisplay(elem) {
    var pos = elem.getBoundingClientRect();
    return (pos.height != 0 && pos.width != 0);
}

function removeHints() {
    if (!hintEnabled)
        return;
    hintEnabled = false;
    deleteHintRules();
    for (var i = 0; i < hintElems.length; i++) {
        hintElems[i].removeAttribute('highlight');
    }
    hintElems = [];
    hintNumStr = '';
    var div = document.body.querySelector('div[highlight=hints]');
    if (div != undefined) {
        document.body.removeChild(div);
    }
    document.removeEventListener('keydown', hintHandler, true);
    document.addEventListener('keydown', initKeyBind, true);
}

function addKeyBind( key, func, eve ){
    var pressedKey = getKey(eve);
    if( pressedKey == key ){
        func();
    }
}

function openUrl(url, newTab){
	var urlTokens = url.split("/");
	if(newTab == false){
		if(urlTokens[0].indexOf(":") != -1){
			window.location.href = url;
		} else {
			window.location.href = 'http://' + url;
		}
	} else
	{
		if(urlTokens[0].indexOf(":") != -1){
			window.open(url);
		} else {
			window.open('http://' + url);
		}
	}
}

function find(word, node)
{
	if (!node){
		unhighlight();
		node = document.body;
	}

	for (node=node.firstChild; node; node=node.nextSibling)
	{
		if (node.nodeType == 3)
		{
			var n = node;
			var match_pos = 0;
			match_pos = n.nodeValue.toLowerCase().indexOf(word.toLowerCase());	
			if (match_pos != -1)
			{
				var before = n.nodeValue.substr(0, match_pos);
				var middle = n.nodeValue.substr(match_pos, word.length);
				var after = document.createTextNode(n.nodeValue.substr(match_pos+word.length));
				var highlight_span = document.createElement("span");

				highlight_span.style.cssText = [ 
                'background-color: yellow !important;',
                'z-index: 2147483647 !important;',
                ].join('');
				
				highlight_span.appendChild(document.createTextNode(middle));
				n.nodeValue = before;
				n.parentNode.insertBefore(after, n.nextSibling);
				n.parentNode.insertBefore(highlight_span, n.nextSibling);
				highlights.push(highlight_span);
				highlight_span.id = "highlight_span"+highlights.length;
				node=node.nextSibling;
			}
		} else
		{
			if (node.nodeType == 1 && node.nodeName.match(/textarea/i) && !getStyle(node, "display").match(/none/i)) 
			{
				textarea2pre(node);
			} else
			{
				if (node.nodeType == 1 && !getStyle(node, "visibility").match(/hidden/i) &&
					node.nodeType == 1 && !getStyle(node, "display").match(/none/i))
				{
					find(word, node);
				}
			}
		}
	}
}


function unhighlight()
{
	for (var i = 0; i < highlights.length; i++)
	{
		
		var the_text_node = highlights[i].firstChild;
		var parent_node = highlights[i].parentNode;
		if (highlights[i].parentNode)
		{
			highlights[i].parentNode.replaceChild(the_text_node, highlights[i]);
			if (i == find_pointer) selectElementContents(the_text_node);
			parent_node.normalize();
		}
	}
	highlights = [];
	find_pointer = -1;
}

function findNext()
{
	var current_find;
	
	if (findPointer != -1)
	{
		current_find = highlights[findPointer];

		current_find.style.cssText = [ 
			'background-color: yellow !important;',
			'z-index: 2147483647 !important;',
		].join('');
	}	
	
	findPointer++;
	
	if (findPointer >= highlights.length)
			findPointer = 0;
	
	var display_find = findPointer+1;
	
	current_find = highlights[findPointer];
	
	current_find.style.cssText = [ 
		'background-color: orange !important;',
		'z-index: 2147483647 !important;',
	].join('');
			
	scrollToPosition(highlights[findPointer]);
	
}

function findPrev()
{
	var current_find;
	
	if (highlights.length < 1) return;
	
	if (findPointer != -1)
	{
		current_find = highlights[findPointer];
		
		current_find.style.cssText = [ 
			'background-color: yellow !important;',
			'z-index: 2147483647 !important;',
		].join('');
	}	
	
	findPointer--;
	
	if (findPointer < 0)
			findPointer = highlights.length-1;
	
	var display_find = findPointer+1;
	
	current_find = highlights[findPointer];
	
	current_find.style.cssText = [ 
		'background-color: orange !important;',
		'z-index: 2147483647 !important;',
	].join('');
				
	scrollToPosition(highlights[findPointer]);
}

function scrollToPosition(field)
{ 
	var scrollLeft = document.body.scrollLeft || document.documentElement.scrollLeft;
	var scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
	var scrollBottom = (window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight) + scrollTop;
	var scrollRight = (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth) + scrollLeft;

   if (field)
   {
		var theElement = field;  
		var elemPosX = theElement.offsetLeft;  
		var elemPosY = theElement.offsetTop;  
		theElement = theElement.offsetParent;  
		while(theElement != null)
	   	{  
			elemPosX += theElement.offsetLeft   
			elemPosY += theElement.offsetTop;  
			theElement = theElement.offsetParent; 
		} 
		if (elemPosX < scrollLeft || elemPosX > scrollRight ||
			elemPosY < scrollTop || elemPosY > scrollBottom) 
		field.scrollIntoView();
	}
}



function textarea2pre(el)
{		
	if (el.nextSibling && el.nextSibling.id && el.nextSibling.id.match(/pre_/i))
		var pre = el.nextsibling;
	else
		var pre = document.createElement("pre");
	
	var the_text = el.value; 
	the_text = the_text.replace(/>/g,'&gt;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
	pre.innerHTML = the_text;
	
	var completeStyle = "";

	    completeStyle = window.getComputedStyle(el, null).cssText;
		pre.style.cssText = completeStyle;
	el.parentNode.insertBefore(pre, el.nextSibling);
	el.onblur = function() { this.style.display = "none"; pre.style.display = "block"; };
	el.onchange = function() { pre.innerHTML = el.value.replace(/>/g,'&gt;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); };
	
	el.style.display = "none";
	pre.id = "pre_"+highlights.length;
	
	pre.onclick = function() {this.style.display = "none"; el.style.display = "block"; el.focus(); el.click()};
}


function getStyle(el,styleProp)
{
	var x = (document.getElementById(el)) ? document.getElementById(el) : el;
	if (x.currentStyle) // IE
		var y = x.currentStyle[styleProp];
	else if (window.getComputedStyle)  // FF
		var y = document.defaultView.getComputedStyle(x,null).getPropertyValue(styleProp);
	return y;
}

function parseCommand(e){
	if(e.keyCode == 13) {

		var panel = document.getElementById('zsurf-panel');
		var input = document.getElementById('zsurf-console');
		commandHistory.push(input.value);

		var commandTokens = input.value.split(' ');

		if( commandTokens[0] === ':open' ){
			commandTokens.shift();
			var url = commandTokens.join(' ');
			openUrl(url, false);
			input.blur();
			panel.hide();
			return;
		} else if( commandTokens[0] === ':search' ){
			commandTokens.shift();
			var search = commandTokens.join(' ');
			find(search);
			input.blur();
			panel.hide();
			return;
		} else if( commandTokens[0] === ':openTab' ){
			commandTokens.shift();
			var url = commandTokens.join(' ');
			openUrl(url, true);
			input.blur();
			panel.hide();
			return;
		} else if( commandTokens[0] === ':q' ){
			window.close();
			input.blur();
			panel.hide();
			return;
		}

	} else if(e.keyCode == 8) {
		var input = document.getElementById('zsurf-console');

		if(document.activeElement == input){
			addKeyBind( 'Up', function(){prevCommand();}, e );
			addKeyBind( 'Down', function(){nextCommand();}, e );
		}

		if(input.value.length == 1){
			input.blur();
			return;
		}
	}

	e.stopPropagation();
	e.stopImmediatePropagation();
} 

function inputText(command){
	var panel = createGui();
	panel.show();
	var console = document.getElementById('zsurf-console');
	console.value = command;
	console.focus();
}

function unfocus(){
	removeHints()
	if(document.activeElement != null){
		var panel = document.querySelector("#zsurf-panel");
		panel.hide();
		setTimeout(function(){
			document.activeElement.blur();
		}, 1);
	}
}

function setClipboard(text){
    var input = document.createElement('input');
	input.style.position = "fixed";
	input.style.top = 0;
	input.type = "text";
    document.body.appendChild(input);
	input.value = window.location;
	input.focus();
	input.select();
	document.execCommand('copy', false, text);
	input.remove();
}

function getClipboard(text){
	return 0;
}

function zoom(step){
	zoomLevel = Math.min(Math.max(zoomLevel + step, 0.2), 5);
	document.body.style.zoom = zoomLevel;
	localStorage.setItem('zoomLevel', zoomLevel);
}


function prevCommand(){
	if(commandPointer > 0){
		commandPointer--;
	} else {
		commandPointer = commandHistory.length -1;
	}
	inputText(commandHistory[commandPointer]);
}

function nextCommand(){
	if(commandPointer < commandHistory.length -1){
		commandPointer++;
	} else {
		commandPointer = 0;
	}
	inputText(commandHistory[commandPointer]);
}

function initKeyBind(e){

	if(!allowPassthrough){
		var t = e.target;
		if( t.nodeType == 1){
			if( (textInputs.indexOf(document.activeElement.type) == -1 &&
				document.activeElement.contentEditable != "true") ){
				addKeyBind( 'f', function(){hintMode();}, e );
				addKeyBind( 'F', function(){hintMode(true);}, e );
				addKeyBind( 'o', function(){inputText(":open ");}, e );
				addKeyBind( 't', function(){inputText(":openTab ");}, e );
				addKeyBind( 'r', function(){window.location.reload(false);}, e );
				addKeyBind( 'R', function(){alert(zoomLevel);}, e );
				addKeyBind( ':', function(){inputText(":");}, e );
				addKeyBind( 'y', function(){setClipboard(window.location);}, e );

				addKeyBind( 'j', function(){window.scrollBy(0,50);}, e );
				addKeyBind( 'k', function(){window.scrollBy(0,-50);}, e );
				addKeyBind( 'h', function(){window.scrollBy(-50,0);}, e );
				addKeyBind( 'l', function(){window.scrollBy(50,0);}, e );

				addKeyBind( 'H', function(){window.history.back();}, e );
				addKeyBind( 'L', function(){window.history.forward();}, e );

				addKeyBind( 'g', function(){window.scrollTo(0,0);}, e );
				addKeyBind( 'G', function(){window.scrollTo(0,document.body.scrollHeight);}, e );

				addKeyBind( 'U', function(){window.scrollBy(0,-window.innerHeight);}, e );
				addKeyBind( 'D', function(){window.scrollBy(0,window.innerHeight);}, e );

				addKeyBind( 'I', function(){zoom(0.1);}, e );
				addKeyBind( 'O', function(){zoom(-0.1);}, e );

				addKeyBind( 'Divide', function(){inputText(":search ");}, e );
				addKeyBind( 'p', function(){findPrev();}, e );
				addKeyBind( 'n', function(){findNext();}, e );

				e.preventDefault();
				//e.stopPropagation();
				//e.stopImmediatePropagation();
			}
		}
		
		var input = document.getElementById('zsurf-console');
		if(document.activeElement == input){
			addKeyBind( 'Up', function(){prevCommand();}, e );
			addKeyBind( 'Down', function(){nextCommand();}, e );
		}

		addKeyBind( 'Esc', function(){unfocus(); unhighlight();}, e );

	}
	addKeyBind( 'Insert', function(){togglePassthrough();}, e );
}

var keyId = {
	"U+2190" : "Left",
	"U+2191" : "Up",
	"U+2192" : "Right",
	"U+2193" : "Down",
    "U+0008" : "BackSpace",
    "U+0009" : "Tab",
    "U+0018" : "Cancel",
    "U+001B" : "Esc",
    "U+0020" : "Space",
    "U+007F" : "Delete",
    "U+20AC" : "€",
    "U+0021" : "!",
    "U+0022" : "\"",
    "U+0023" : "#",
    "U+0024" : "$",
    "U+0026" : "&",
    "U+0027" : "'",
    "U+0028" : "(",
    "U+0029" : ")",
    "U+002A" : "*",
    "U+002B" : "+",
    "U+002C" : ",",
    "U+002D" : "-",
    "U+002E" : ".",
    "U+002F" : "/",
    "U+0030" : "0",
    "U+0031" : "1",
    "U+0032" : "2",
    "U+0033" : "3",
    "U+0034" : "4",
    "U+0035" : "5",
    "U+0036" : "6",
    "U+0037" : "7",
    "U+0038" : "8",
    "U+0039" : "9",
    "U+003A" : ":",
    "U+003B" : ";",
    "U+003C" : "<",
    "U+003D" : "=",
    "U+003E" : ">",
    "U+003F" : "?",
    "U+0040" : "@",
    "U+0041" : "a",
    "U+0042" : "b",
    "U+0043" : "c",
    "U+0044" : "d",
    "U+0045" : "e",
    "U+0046" : "f",
    "U+0047" : "g",
    "U+0048" : "h",
    "U+0049" : "i",
    "U+004A" : "j",
    "U+004B" : "k",
    "U+004C" : "l",
    "U+004D" : "m",
    "U+004E" : "n",
    "U+004F" : "o",
    "U+0050" : "p",
    "U+0051" : "q",
    "U+0052" : "r",
    "U+0053" : "s",
    "U+0054" : "t",
    "U+0055" : "u",
    "U+0056" : "v",
    "U+0057" : "w",
    "U+0058" : "x",
    "U+0059" : "y",
    "U+005A" : "z",
    "U+00DB" : "[",
    "U+00DC" : "\\",
    "U+00DD" : "]",
    "U+005E" : "^",
    "U+005F" : "_",
    "U+0060" : "`",
    "U+007B" : "{",
    "U+007C" : "|",
    "U+007D" : "}",
    "U+00A1" : "¡",
}

function getKey(evt){

    var key = keyId[evt.keyIdentifier] || evt.keyIdentifier,
        ctrl = evt.ctrlKey ? 'C-' : '',
        meta = (evt.metaKey || evt.altKey) ? 'M-' : '',
        shift = evt.shiftKey ? 'S-' : '';
    if (evt.shiftKey){
        if (/^[a-z]$/.test(key)) 
            return ctrl+meta+key.toUpperCase();
        if (/^[0-9]$/.test(key)) {
            switch(key) {
                // TODO
                case "4":
                    key = "$";
                break;
            };
            return key;
        }
        if (/^(Enter|Space|BackSpace|Tab|Esc|Home|End|Left|Right|Up|Down|PageUp|PageDown|F(\d\d?))$/.test(key)) 
            return ctrl+meta+shift+key;
    }
    return ctrl+meta+key;
}
