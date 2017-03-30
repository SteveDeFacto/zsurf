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
window.onwheel = function(e){removeHints(); window.scrollBy(0, -e.wheelDelta); return false; }

document.addEventListener('DOMContentLoaded', function(event) {
	var storedZoomLevel = localStorage.getItem('zoomLevel');

	if(!isNaN(storedZoomLevel) && storedZoomLevel != null){
		zoomLevel = Number(storedZoomLevel);
		document.body.style.zoom = zoomLevel;
	}
	var sheet = document.createElement('style');
	sheet.id = 'zsurf-style';
	sheet.type = 'text/css'
	sheet.innerHTML = 'body {overflow: hidden;} ::-webkit-scrollbar{display:none;}';
	document.body.appendChild(sheet);

	// Create GUI
	createGui();

	// Unfocus active textbox
	unfocus();

});


document.addEventListener('webkitfullscreenchange', function(e){
	if(document.webkitIsFullScreen)	{
		document.body.style.zoom = 1;
	} else {
		document.body.style.zoom = zoomLevel;
	}
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
				'background-color: #000000 !important;',
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

		var splitUrl = window.location.href.split('/').filter(Boolean);
		var shortUrl = window.location.href;
		if(splitUrl.length > 3){
			shortUrl = splitUrl[0] +'//'+ splitUrl[1] + '/../' + splitUrl[splitUrl.length - 1];
		}
		span.innerHTML = shortUrl;
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
			'overflow: hidden !important;',
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
			type == 'mouseup' ||
			type == 'focus'){
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
    var pressedKey = e.key;
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
	var sheet = document.createElement('style');
	sheet.id = 'zsurf-highlight';
	sheet.innerHTML = 'a[highlight=hint_elem] {background-color: yellow !important;}a[highlight=hint_active] {background-color: lime !important;}';
	document.body.appendChild(sheet);
}

function deleteHintRules() {
	document.getElementById('zsurf-highlight').remove();
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

	if (tagName == 'a' && elem.getAttribute('href').length > 0) {
        setHighlight(elem, true);

        if (hintOpenInNewTab) {
            window.open(elem.href);
		} else if(elem.href.indexOf('javascript:') == -1 && elem.getAttribute('href') != '#' ){
			location.href = elem.href;
		} else {
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
	} else if(tagName == 'iframe') {
		elem.contentWindow.focus();
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
    var elems = document.body.querySelectorAll('a, input:not([type=hidden]), [data=events], [role=tab], [role=radio] , [role=option], [role=combobox], [role=checkbox], [role=button], iframe, area, textarea, select, button, [onclick], [onfocus], [data-ui-tracking-context], [ng-click]');

	// Add list of click elements we collected from event listeners
	elems = clickableElems.concat(Array.from(elems));

	// Remove duplicates
	//elems = elems.filter(function(item, pos, self) {
   // 	return self.indexOf(item) == pos;
	//})

    var div = document.createElement('div');
    div.setAttribute('highlight', 'hints');
    document.body.appendChild(div);
    for (var i = 0; i < elems.length; i++) {
        var elem = elems[i];
        if (!isHintDisplay(elem))
            continue;
	    var elemTop = winTop;
        var elemBottom = winTop;
        var elemLeft = winLeft;
        var elemRight = winLeft;	
		if(elem.tagName == 'AREA'){
			var posArray = elem.coords.split(',');
			if(posArray.length == 4){
				var imgElem = document.body.querySelector('[usemap="#'+elem.parentNode.name+'"]');
				elemLeft += Number(posArray[0]) + imgElem.getBoundingClientRect().left;
				elemTop += Number(posArray[1]) + imgElem.getBoundingClientRect().top;
				elemRight += Number(posArray[2]) + imgElem.getBoundingClientRect().left;
				elemBottom += Number(posArray[3]) + imgElem.getBoundingClientRect().top;
			}
		} else {
        	var pos = elem.getBoundingClientRect();
			elemTop += pos.top;
			elemBottom += pos.bottom;
			elemLeft += pos.left;
			elemRight += pos.left;
		}
		
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
                'background-color: ' + (hintOpenInNewTab ? '#ff6600' : '#ff0000') + ' !important;',
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

function isHintDisplay(elem){
    var pos = elem.getBoundingClientRect();
    return elem.tagName == 'AREA' || (pos.height != 0 && pos.width != 0);
}

function removeHints(){
    if (!hintEnabled)
        return;
    hintEnabled = false;
    deleteHintRules();
    for (var i = 0; i < hintElems.length; i++){
        hintElems[i].removeAttribute('highlight');
    }
    hintElems = [];
    hintNumStr = '';
    var div = document.body.querySelector('div[highlight=hints]');
    if (div != undefined){
        document.body.removeChild(div);
    }
    document.removeEventListener('keydown', hintHandler, true);
    document.addEventListener('keydown', initKeyBind, true);
}

function addKeyBind( key, func, eve){
    var pressedKey = eve.key;
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

function findText(word, node){
	if (!node){
		unhighlight();
		node = document.body;
	}

	for (node=node.firstChild; node; node=node.nextSibling){
		if (node.nodeType == 3){
			var n = node;
			var match_pos = 0;
			match_pos = n.nodeValue.toLowerCase().indexOf(word.toLowerCase());	
			if (match_pos != -1){
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
		} else{
			if (node.nodeType == 1 && node.nodeName.match(/textarea/i) && !getStyle(node, "display").match(/none/i)){
				textarea2pre(node);
			} else{
				if (node.nodeType == 1 && !getStyle(node, "visibility").match(/hidden/i) &&
					node.nodeType == 1 && !getStyle(node, "display").match(/none/i))
				{
					findText(word, node);
				}
			}
		}
	}
}

function unhighlight(){
	for (var i = 0; i < highlights.length; i++){
		var the_text_node = highlights[i].firstChild;
		var parent_node = highlights[i].parentNode;
		if (highlights[i].parentNode){
			highlights[i].parentNode.replaceChild(the_text_node, highlights[i]);
			if (i == find_pointer) {
				selectElementContents(the_text_node);
			}
			parent_node.normalize();
		}
	}
	highlights = [];
	find_pointer = -1;
}

function findNext(){
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

function findPrev(){
	var current_find;
	
	if (highlights.length < 1) return;
	
	if (findPointer != -1){
		current_find = highlights[findPointer];
		
		current_find.style.cssText = [ 
			'background-color: yellow !important;',
			'z-index: 2147483647 !important;',
		].join('');
	}	
	
	findPointer--;
	
	if (findPointer < 0)
	{
		findPointer = highlights.length-1;
	}
	
	var display_find = findPointer+1;
	
	current_find = highlights[findPointer];
	
	current_find.style.cssText = [ 
		'background-color: orange !important;',
		'z-index: 2147483647 !important;',
	].join('');
				
	scrollToPosition(highlights[findPointer]);
}

function scrollToPosition(field){ 
	var scrollLeft = document.body.scrollLeft || document.documentElement.scrollLeft;
	var scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
	var scrollBottom = (window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight) + scrollTop;
	var scrollRight = (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth) + scrollLeft;

	if (field){
		var theElement = field;  
		var elemPosX = theElement.offsetLeft;  
		var elemPosY = theElement.offsetTop;  
		theElement = theElement.offsetParent;  
		while(theElement != null){  
			elemPosX += theElement.offsetLeft   
			elemPosY += theElement.offsetTop;  
			theElement = theElement.offsetParent; 
		} 
		if (elemPosX < scrollLeft || elemPosX > scrollRight ||
			elemPosY < scrollTop || elemPosY > scrollBottom) 
		field.scrollIntoView();
	}
}

function textarea2pre(el){		
	if (el.nextSibling && el.nextSibling.id && el.nextSibling.id.match(/pre_/i)){
		var pre = el.nextsibling;
	} else {
		var pre = document.createElement("pre");
	}
	
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


function getStyle(el,styleProp){
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
			findText(search);
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
	var panel = document.querySelector("#zsurf-panel");
	if(panel){
		panel.hide();
	}
	if(document.activeElement != null && document.activeElement != document.body){
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
	input.value = text;
	input.focus();
	input.select();
	document.execCommand('copy');
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
			if( document.activeElement == null ||
				(textInputs.indexOf(document.activeElement.type) == -1 &&
				document.activeElement.contentEditable != "true") ){
				addKeyBind( 'f', function(){hintMode();}, e );
				addKeyBind( 'F', function(){hintMode(true);}, e );
				addKeyBind( 'o', function(){inputText(":open ");}, e );
				addKeyBind( 't', function(){inputText(":openTab ");}, e );
				addKeyBind( 'r', function(){window.location.reload(false);}, e );
				addKeyBind( 'R', function(){window.location.reload(true);}, e );
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

				addKeyBind( '/', function(){inputText(":search ");}, e );
				addKeyBind( 'p', function(){findPrev();}, e );
				addKeyBind( 'n', function(){findNext();}, e );

				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
			}
		}
		var input = document.getElementById('zsurf-console');
		if(document.activeElement == input){
			addKeyBind( 'Up', function(){prevCommand();}, e );
			addKeyBind( 'Down', function(){nextCommand();}, e );
		}
		addKeyBind( 'Escape', function(){

			unfocus();	
			unhighlight();
			window.top.focus();
			if(document.webkitIsFullScreen)	{
				document.webkitCancelFullScreen();
			}
		}, e );
	}
	addKeyBind( 'Insert', function(){togglePassthrough();}, e );
}

