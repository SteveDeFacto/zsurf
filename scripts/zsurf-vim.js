// ==UserScript==
// @name         zsurf-vim
// @version      0.1
// @description  Adds vim style keybindings, link hints, and a vim style console.
// @author       Steven Batchelor
// @match        *://*/*
// @grant        window.close
// @run-at       document-start
// ==/UserScript==

var hintNumStr = '';
var hintElems = [];
var hintOpenInNewTab = false;
var hintEnabled = false;
var hintKeys = ';asdfghjkl';
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
var allowPassthrough = false;
var passthroughEvents = [];
var clickableElems = [];
var focusableElems = [];
var jsLogger = null;
var focusedElement = null;
var focusMode = false;
var zsurfLog = '';
var addEventListener_;
var removeEventListener_;

// Intercept console logging
jsLogger = console.log;
console.log = function(message) {
	zsurfLog += message;
	jsLogger.apply(console, arguments);
};

// Check if a function is native or not.
function isNative(func) {
  return !('prototype' in func);
}

function isArray(obj) {
	if (obj != undefined && obj.constructor.toString().indexOf('Array') != -1) {
		return true;
	}
	return false;
}

// Intercept all calls to addEventListener or removeEventListener.
addEventListener_ = HTMLElement.prototype.addEventListener;
removeEventListener_ = HTMLElement.prototype.removeEventListener;
HTMLElement.prototype.addEventListener = addEventListenerExt;
HTMLElement.prototype.removeEventListener = removeEventListenerExt;

// Extended addEventListener
function addEventListenerExt(type, callback, capture) {
	if(callback != parseCommand && callback != initKeyBind && callback != hintHandler && !isNative(callback)){

		var eventArguments = {
			"type" : type,
			"callback" : callback,
			"capture" : capture
		};

		if(eventListeners[this] === undefined) {
			eventListeners[this] = [eventArguments];
		} else {
			eventListeners[this].push(eventArguments);
		}

		if( type != 'keydown' &&
			type != 'keyup' &&
			type != 'keypress') {
			if( type == 'click' ||
				type == 'dblclick' ||
				type == 'pointerdown' ||
				type == 'touchstart' ||
				type == 'mousedown'){
				clickableElems.push(this);
			} else if( type == 'click' ||
				type == 'touchmove' ||
				type == 'mouseenter' ||
				type == 'mouseover' ||
				type == 'mousemove' ||
				type == 'focus'){
				focusableElems.push(this);
			}

			return addEventListener_.apply(this, arguments);
		} else if(!allowPassthrough){

			passthroughEvents.push({
				"element" : this,
				"type" : type,
				"callback" : callback,
				"capture" : capture
			});
		}

	} else {
		return addEventListener_.apply(this, arguments);
	}
}

// Extended removeEventListener
function removeEventListenerExt(type, callback, capture) {

	if(!isNative(callback)){
		if(eventListeners[this] === undefined) {
			eventListeners[this] = [];
		} else {
			var i = eventListeners[this].indexOf(type);
			if(i != -1) {
				eventListeners[this].splice(type, i);
			}
		}
	}
	return removeEventListener_.apply(this, arguments);
}

// Log errors
window.addEventListener('error', function(event) {
	zsurfLog += event.message + '\n';
	return false;
});

// Listen for messages from primary window
window.addEventListener("message", function(e){
	if(window !== window.top){
		var messageData = e.data.split(':');
		if(messageData[0] == 'zoomLevel'){
			zoomLevel = Number(messageData[1]);
			document.body.style.zoom = zoomLevel;
			var iframes = document.getElementsByTagName("iframe");
			for(var i = 0; i < iframes.length; i++){
				iframes[i].contentWindow.postMessage('zoomLevel:' + zoomLevel.toString(), '*');
			}
		}
	}
}, false);

// Handle onwheel event
window.onwheel = function(e){
	removeHints();
	if(e.ctrlKey){
		zoom(e.wheelDelta/1000);
	} else if(e.altKey){
		window.scrollBy(-e.wheelDelta, 0);
	} else {
		window.scrollBy(0, -e.wheelDelta);
	}
	return true;
};

document.addEventListener('DOMContentLoaded', function(event) {

	if(window === window.top){

		// Set zoom level for page
		var storedZoomLevel = localStorage.getItem('zoomLevel');

		if(!isNaN(storedZoomLevel) && storedZoomLevel !== null){
			zoomLevel = Number(storedZoomLevel);
			document.body.style.zoom = zoomLevel;
		}

		var iframes = document.getElementsByTagName("iframe");
		for(var i = 0; i < iframes.length; i++){
			iframes[i].addEventListener('load', function(event) {
				this.contentWindow.postMessage('zoomLevel:' + zoomLevel.toString(), '*');
			});
		}
	}

	// Remove scrollbars from the page
	var sheet = document.createElement('style');
	sheet.id = 'zsurf-style';
	sheet.type = 'text/css';
	sheet.innerHTML = 'body {overflow: hidden !important;}' +
		'::-webkit-scrollbar{display: none !important;}' +
		'.blinking {' +
		'  -webkit-animation: 1s blink step-end infinite;' +
		'  animation: 1s blink step-end infinite;' +
		'}' +
		'@-webkit-keyframes "blink" {' +
		'  from, to {' +
		'    color: transparent;' +
		'  }' +
		'  50% {' +
		'    color: white;' +
		'  }' +
		'}';

	document.body.appendChild(sheet);

	focusedElement = window;

	// Try to unfocus active textbox(This doesn't always work)
	unfocus();

});

// Full screen event listener to adjust zoomlevel to normal while fullscreen
document.addEventListener('webkitfullscreenchange', function(e){
	if(document.webkitIsFullScreen)	{
		document.body.style.zoom = 1;
	} else {
		document.body.style.zoom = zoomLevel;
	}
});

// Main keydown event listener for normal mode
document.addEventListener('keydown', initKeyBind, true);

// This method will check if gui exists and create it if it doesn't
function createGui(){

	var panel = document.getElementById('zsurf-panel');

	if(panel === null){

		var zsurfInfo = document.createElement('textarea');
			zsurfInfo.id = "zsurf-info";
			zsurfInfo.style.cssText = [
				'display: none;',
				'width: 100% !important;',
				'left: 0px !important;',
				'bottom: 26px !important;',
				'height: 100px !important;',
				'position: fixed !important;',
				'color: white !important;',
				'background-color: rgba(0,0,64,0.8) !important;',
				'font-family: Arial, Helvetica, sans-serif !important;',
				'font-style: normal !important;',
				'font-size: 13px !important;',
				'font-weight: bold !important;',
				'border-top: 1px dashed gray !important;',
				'z-index: 2147483647 !important;',
				'margin: 0 !important;',
				'padding: 0 !important;',
			].join('');

		zsurfInfo.show = function() {
			this.value = zsurfLog;
			this.style.display = 'block';
		};

		zsurfInfo.hide = function() {
			this.style.display = 'none';
			var zsurfConsole = document.getElementById('zsurf-console');
			if(zsurfConsole.value.split(' ').length > 1){
				commandHistory.push(zsurfConsole.value);
				commandPointer = commandHistory.length -1;
			}
		};

		var zsurfPanel = document.createElement('div');
			zsurfPanel.id = "zsurf-panel";
			zsurfPanel.style.cssText = [
				'right: 0px !important;',
				'left: 0px !important;',
				'bottom: 0px !important;',
				'height: 26px !important;',
				'position: fixed !important;',
				'color: white !important;',
				'background-color: rgba(0,0,0,0.8) !important;',
				'font-family: Arial, Helvetica, sans-serif !important;',
				'font-style: normal !important;',
				'font-size: 13px !important;',
				'font-weight: bold !important;',
				'border-top: 1px dashed gray !important;',
				'z-index: 2147483647 !important;',
				'margin: 0 !important;',
				'padding: 0 !important;',
			].join('');

		zsurfPanel.show = function(){
			this.style.display = 'block';
		};

		zsurfPanel.hide = function(){
			this.style.display = 'none';
			zsurfInfo.hide();
		};

		var zsurfConsole = document.createElement('input');
		zsurfConsole.id = "zsurf-console";
		zsurfConsole.type = "text";
		zsurfConsole.addEventListener('keydown', parseCommand, true);

		zsurfConsole.style.cssText = [
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

		var zsurfLocation = document.createElement('span');
		zsurfLocation.id = "zsurf-location";

		var splitUrl = window.location.href.split('/').filter(Boolean);
		var shortUrl = window.location.href;
		if(splitUrl.length > 3){
			shortUrl = splitUrl[0] +'//'+ splitUrl[1] + '/../' + splitUrl[splitUrl.length - 1];
		}
		zsurfLocation.innerHTML = shortUrl;
		//'<span class="blinking">&nbsp;&nbsp;\u2193</span>';
		zsurfLocation.style.cssText = [
			'right: 0px !important;',
			'bottom: 0px !important;',
			'height: 22px !important;',
			'position: fixed !important;',
			'color: lime !important;',
			'font-family: Arial, Helvetica, sans-serif !important;',
			'font-style: normal !important;',
			'font-size: 13px !important;',
			'font-weight: bold !important;',
			'text-align: right;',
			'outline: none !important;',
			'overflow: hidden !important;',
			'z-index: 2147483647 !important;',
			'margin: 0px 10px 0px 0px !important;',
			'padding: 0 !important;',
			'line-height: 18px !important;',
		].join('');

		zsurfPanel.appendChild(zsurfLocation);
		zsurfPanel.appendChild(zsurfConsole);
		zsurfPanel.appendChild(zsurfInfo);

		document.body.appendChild(zsurfPanel);
		return zsurfPanel;
	} else {
		return panel;
	}
}

// Toggle passthrough mode
function togglePassthrough(){
	if(allowPassthrough){
		allowPassthrough = false;
		for(var i = 0; i < passthroughEvents.length; i++){
			passthroughEvents[i]['element'].removeEventListener(
				passthroughEvents[i].type,
				passthroughEvents[i].callback,
				passthroughEvents[i].capture);
		}
		document.removeEventListener('keydown', initKeyBind, false);

		setTimeout(function(){
			document.addEventListener('keydown', initKeyBind, true);
		}, 1000);
	} else {
		allowPassthrough = true;
		for(var i = 0; i < passthroughEvents.length; i++){
			passthroughEvents[i].element.addEventListener(
				passthroughEvents[i].type,
				passthroughEvents[i].callback,
				passthroughEvents[i].capture);
		}
		document.removeEventListener('keydown', initKeyBind, true);

		setTimeout(function(){
			document.addEventListener('keydown', initKeyBind, false);
		}, 1000);
	}
}

// Convert number to string
function num2Str(num){
	var strNum = '';
	for (var i = 0; i < num.toString().length; i++) {
		strNum += hintKeys.charAt(Number(num.toString().charAt(i)));
	}
	return strNum;
}

// Convert string to number
function str2Num(str){
	var numStr = '';
	for (var i = 0; i < str.length; i++) {
		numStr += hintKeys.indexOf(str.charAt(i));
	}
	return Number(numStr);
}

// Display wrapper for setHints
function hintMode(type){
    hintEnabled = true;
    if (type == 0) {
        hintOpenInNewTab = false;
    } else if(type == 1){
        hintOpenInNewTab = true;
    } else if(type == 2){
		focusMode = true;
    }
    setHints();
    document.removeEventListener('keydown', initKeyBind, true);
    document.addEventListener('keydown', hintHandler, true);
    hintNumStr = '';
}

// Handles key events for hint mode
function hintHandler(e){
    var pressedKey = e.key;
    if (pressedKey == 'Enter') {
        if (hintNumStr === '')
            hintNumStr = '1';
        judgeHintNum(str2Num(hintNumStr));

    } else if (hintKeys.indexOf(pressedKey) == -1) {
        removeHints();
    } else {
        hintNumStr += pressedKey;
        var hintNum = str2Num(hintNumStr);
        if (hintNum * 10 > hintElems.length + 1) {
            judgeHintNum(hintNum);
        } else {
            var hintElem = hintElems[hintNum - 1];

            if (hintElem !== undefined && hintElem.tagName.toLowerCase() == 'a') {
                setHighlight(hintElem, true);
            }
        }
    }
	e.preventDefault();
	e.stopPropagation();
	e.stopImmediatePropagation();
}

// Creates search highlights
function setHighlight(elem, isActive) {
    if (isActive) {
        var activeElem = document.body.querySelector('a[highlight=hint_active]');
        if (activeElem !== null)
            activeElem.setAttribute('highlight', 'hint_elem');
        elem.setAttribute('highlight', 'hint_active');
    } else {
        elem.setAttribute('highlight', 'hint_elem');
    }
}

// This will set hint style rules for the page.
function setHintRules() {
	var sheet = document.createElement('style');
	sheet.id = 'zsurf-highlight';
	sheet.innerHTML = 'a[highlight=hint_elem] {background-color: yellow !important;}a[highlight=hint_active] {background-color: lime !important;}';
	document.body.appendChild(sheet);
}

// This deletes hint style rules
function deleteHintRules() {
	document.getElementById('zsurf-highlight').remove();
}

// Wrapper for execSelect to prevent it from operating on an undefined hint
function judgeHintNum(hintNum) {
    var hintElem = hintElems[hintNum - 1];
    if (hintElem !== undefined) {
		if(focusMode){
			focusedElement = hintElem;	
			removeHints();
		} else {
			removeHints();
			if(!isArray(hintElem)){
				execSelect(hintElem);
			} else {
				for(var i = hintElem.length-1; i >= 0; i--){
					execSelect(hintElem[i]);
				}
			}
		}
	} else {
        removeHints();
    }
}

// This will execute an appropriate action based on the type of element
function execSelect(elem) {
    var tagName = elem.tagName.toLowerCase();
    var type = elem.type ? elem.type.toLowerCase() : "";
	if (tagName == 'a' && elem.hasAttribute('href') && elem.getAttribute('href').length > 0) {
        if (hintOpenInNewTab) {
            window.open(elem.href);
		} else if(elem.href.indexOf('javascript:') == -1 &&
				elem.hasAttribute('href') &&
				elem.getAttribute('href') != '#' &&
				elem.hasAttribute('role') &&
				elem.getAttribute('role') != 'button'){
			location.href = elem.href;
		} else {
			elem.click();
		}
	} else if (tagName == 'input' && (type == "submit" || type == "button" || type == "reset")) {
		elem.click();
    } else if (tagName == 'input' && (type == "radio" || type == "checkbox")) {
        elem.checked = !elem.checked;
    } else if (tagName == 'input' || tagName == 'textarea') {
		elem.focus();
		elem.click();
        elem.setSelectionRange(elem.value.length, elem.value.length);
	} else if(tagName == 'iframe') {
		elem.contentWindow.focus();
    } else {
		elem.click();
	}
}

// Displays hints for the page
function setHints() {
    setHintRules();

    var winTop = window.scrollY/zoomLevel;
    var winBottom = winTop + (window.innerHeight/zoomLevel);
    var winLeft = window.scrollX/zoomLevel;
    var winRight = winLeft + (window.innerWidth/zoomLevel);
	var elemLeftList = [];
	var elemTopList = [];

	// Ignore scroll offset in full screen mode
	if(document.webkitIsFullScreen){
		winTop = 0;
		winLeft = 0;
		winBottom = window.innerHeight;
		winRight = window.innerWidth;
	}

	// Query elements which can be clicked
    var elems = document.body.querySelectorAll('a, article, nav, input:not([type=hidden]), [data=events], ' +
			'[role=tab], [role=radio], [role=option], [role=combobox], [role=checkbox], ' +
			'[role=button], [role=listbox], iframe, area, span, textarea, select, button, [onpointerdown], ' +
			'[ondblclick], [onclick], [onfocus], [data-ui-tracking-context], ' +
			'[data-link], [ng-click], [jsaction]');

	// Add list of click elements we collected from event listeners
	elems = clickableElems.concat(Array.from(elems));

	// Remove duplicates
	elems = elems.filter(function(item, pos, self) {
    	return self.indexOf(item) == pos;
	});

    var div = document.createElement('div');
    div.setAttribute('highlight', 'hints');

	// Add hints to full screen element for full screen mode
	if(document.webkitIsFullScreen){
		document.webkitCurrentFullScreenElement.appendChild(div);
	} else {
    	document.body.appendChild(div);
	}

    for (var i = 0; i < elems.length; i++) {
        var elem = elems[i];
        if (!isHintDisplay(elem))
            continue;
	    var elemTop = winTop;
        var elemBottom = winTop;
        var elemLeft = winLeft;
        var elemRight = winLeft;
		if(elem.tagName == 'AREA'){

			// Get the position of the area tag from a combination of parent img and coords attribute.
			var posArray = elem.coords.split(',');
			if(posArray.length == 4){
				var imgElem = document.body.querySelector('[usemap="#'+elem.parentNode.name+'"]');
                if(imgElem != null){
                    elemLeft += Number(posArray[0]) + imgElem.getBoundingClientRect().left;
                    elemTop += Number(posArray[1]) + imgElem.getBoundingClientRect().top;
                    elemRight += Number(posArray[2]) + imgElem.getBoundingClientRect().left;
                    elemBottom += Number(posArray[3]) + imgElem.getBoundingClientRect().top;
                }
			}
		} else {

			// Can just get client rect for standard elements
        	var pos = elem.getBoundingClientRect();
            if(pos != null){
                elemTop += pos.top;
                elemBottom += pos.bottom;
                elemLeft += pos.left;
                elemRight += pos.left;
            }
		}

		// Give hint an offset if another hint is already at this position
		var elemAtPosition = -1;
		for(var j = 0; j < elemLeftList.length; j++){
			if(elemLeft >= elemLeftList[j] - 18 && elemLeft < elemLeftList[j] + 18 &&
				elemTop >= elemTopList[j] - 14 && elemTop < elemTopList[j] + 14) {
				elemAtPosition = j;
			}
		}

		// Add hint to page
        if ( elemBottom >= winTop && elemTop <= winBottom) {
			if(elemAtPosition == -1){
				elemLeftList.push(elemLeft);
				elemTopList.push(elemTop);
				hintElems.push(elem);
				setHighlight(elem, false);
				var hint = document.createElement('div');
				hint.style.cssText = [
					'left: ', elemLeft, 'px !important;',
					'top: ', elemTop, 'px !important;',
					'position: absolute !important;',
					'background-color: ' + (focusMode ? 'rgba(0, 128, 255, 0.6)' : (hintOpenInNewTab ? 'rgba(255, 128, 0, 0.6)' : 'rgba(255, 0, 0, 0.6)' )) + ' !important;',
					'border: 1px solid white !important;',
					'text-shadow: 1px 1px #000000 !important;',
					'color: white !important;',
					'font-family: Arial, Helvetica, sans-serif !important;',
					'font-style: normal !important;',
					'font-size: 14px !important;',
					'font-weight: bold !important;',
					'padding: 0px 1px !important;',
					'margin: 0px !important;',
					'z-index: 2147183647 !important;',
					'text-transform: uppercase !important;',
				].join('');
				hint.innerHTML = num2Str(hintElems.length);
				div.appendChild(hint);
				if (elem.tagName.toLowerCase() == 'a') {
					if (hintElems.length == 1) {
						setHighlight(elem, true);
					} else {
						setHighlight(elem, false);
					}
				}
			} else {
				if(!isArray( hintElems[elemAtPosition])){
					hintElems[elemAtPosition] = [hintElems[elemAtPosition], elem];
				} else {
					hintElems[elemAtPosition].push(elem);
				}
			}
        }
    }
}

// Checks if hint should be displayed
function isHintDisplay(elem){
    if(elem !== null && elem.getBoundingClientRect !== undefined){
        var pos = elem.getBoundingClientRect();
        return elem.tagName == 'AREA' || (pos !== null && pos.height !== 0 && pos.width !== 0);
    }
    return false;
}

// Remove/hides hints on the page
function removeHints(){

    if (!hintEnabled)
        return;
    hintEnabled = false;
    deleteHintRules();
	focusMode = false;
    hintElems = [];
    hintNumStr = '';
    var div = document.body.querySelector('div[highlight=hints]');
    if (div !== undefined){
		div.parentNode.removeChild(div);
    }
    document.removeEventListener('keydown', hintHandler, true);
    document.addEventListener('keydown', initKeyBind, true);

}

// Simple wrapper to execute desired function when specified key is pressed.
function addKeyBind( key, func, eve){
    var pressedKey = eve.key;
    if( pressedKey == key ){
        func();
    }
}

// Opens a URL in either current tab or a new tab and makes sure there is a URL protocol
function openUrl(url, newTab){
	var urlTokens = url.split("/");
	if(newTab === false){
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

// Searches page for specified text
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

// Removes search highlights from the page
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

// Takes user to next highlighted search result
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

// Takes user to previous highlighted search result
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

// Will scroll page to specified element
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
			elemPosX += theElement.offsetLeft;
			elemPosY += theElement.offsetTop;
			theElement = theElement.offsetParent;
		}
		if (elemPosX < scrollLeft || elemPosX > scrollRight ||
			elemPosY < scrollTop || elemPosY > scrollBottom)
		field.scrollIntoView();
	}
}

// Highlight text within textarea
function textarea2pre(el){
    var pre;
	if (el.nextSibling && el.nextSibling.id && el.nextSibling.id.match(/pre_/i)){
		pre = el.nextsibling;
	} else {
		pre = document.createElement("pre");
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

	pre.onclick = function() {this.style.display = "none"; el.style.display = "block"; el.focus(); el.click();};
}

// Get computed style property of an element
function getStyle(el,styleProp){
	var elem = (document.getElementById(el)) ? document.getElementById(el) : el;
	var property = document.defaultView.getComputedStyle(elem,null).getPropertyValue(styleProp);
	return property;
}

// Determine the command being ran, get arguments, and run the command
function parseCommand(e){
	if(e.keyCode == 13) {
		e.preventDefault();

		var panel = document.getElementById('zsurf-panel');
		var input = document.getElementById('zsurf-console');
		var info = document.getElementById('zsurf-info');

		if(input.value.split(' ').length > 1){
			commandHistory.push(input.value);
			commandPointer = commandHistory.length -1;
		}

		var commandTokens = input.value.split(' ');

		if( commandTokens[0] === ':open' ){
			commandTokens.shift();
			var url = commandTokens.join(' ');
			openUrl(url, false);
			input.blur();
			panel.hide();
		} else if( commandTokens[0] === ':search' ){
			commandTokens.shift();
			var search = commandTokens.join(' ');
			findText(search);
			input.blur();
			panel.hide();
		} else if( commandTokens[0] === ':openTab' ){
			commandTokens.shift();
			var windowUrl = commandTokens.join(' ');
			openUrl(windowUrl, true);
			input.blur();
			panel.hide();
		} else if( commandTokens[0] === ':evaluate' ){
			commandTokens.shift();
			var js = commandTokens.join(' ');
			zsurfLog += eval(js) + '\n';
			info.scrollTop = info.scrollHeight;
			info.show();
		} else if( commandTokens[0] === ':q' ){
			window.close();
			input.blur();
			panel.hide();
		}
	} else if(e.keyCode == 9){
		e.preventDefault();

		var input = document.getElementById('zsurf-console');

		var commandTokens = input.value.split(' ');

		if( commandTokens[0] === ':evaluate' ){
			commandTokens.shift();
			var js = commandTokens.join(' ');

			var complete = js.substring(js.lastIndexOf('.')+1, js.length);
			var searchStr = js.substring(0, js.lastIndexOf('.'));
			var searchElem = eval(searchStr.length > 0 ? searchStr : 'window' );
			var propertyNames = Object.getOwnPropertyNames(searchElem).filter(x => x.startsWith(complete));

			if(propertyNames[0] != undefined){
				input.value = ':evaluate ' + searchStr + (searchStr.length > 0 ? '.' : '') + propertyNames[0];
			}
		}
	}

	e.stopPropagation();
	e.stopImmediatePropagation();
}

// Show panel and set command
function inputText(command){
	var panel = createGui();
	panel.show();

	var console = document.getElementById('zsurf-console');
	console.value = command;
	console.focus();

	var info = document.getElementById('zsurf-info');
	if(command === ':evaluate ' && zsurfLog.length > 0){
		info.show();
	}
}

// Unfocus/hide panel
function unfocus(){
	removeHints();
	var panel = document.querySelector("#zsurf-panel");
	if(panel){
		panel.hide();
	}
	if(document.activeElement != null && document.activeElement != document.body){
		setTimeout(function(){
			document.activeElement.blur();
			document.body.click();
		}, 1);
	}
}

// Set text in clipboard
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

// Set zoom level within limits and store it in local storage for later visits to this site.
function zoom(step){
	zoomLevel = Math.min(Math.max(zoomLevel + step, 0.2), 5);
	document.body.style.zoom = zoomLevel;

	if(window === window.top){
		localStorage.setItem('zoomLevel', zoomLevel);
	}

	var iframes = document.getElementsByTagName("iframe");
	for(var i = 0; i < iframes.length; i++){
		iframes[i].contentWindow.postMessage('zoomLevel:' + zoomLevel.toString(), '*');
	}
}

// Set console to previous command in history
function prevCommand(){
	if(commandPointer > 0){
		commandPointer--;
	} else {
		commandPointer = commandHistory.length -1;
	}
	inputText(commandHistory[commandPointer]);
}

// Set console to next command in history
function nextCommand(){
	if(commandPointer < commandHistory.length -1){
		commandPointer++;
	} else {
		commandPointer = 0;
	}
	inputText(commandHistory[commandPointer]);

}

// Scroll through info window
function scrollInfoBy(offset){
	var info = document.getElementById('zsurf-info');
	info.scrollTop += offset;
}

function scrollElementBy(elem, offsetLeft, offsetTop){
	if(elem == window){
		window.scrollBy(offsetLeft, offsetTop);
	} else {
		if(!isArray(elem)){
			elem.scrollLeft += offsetLeft;
			elem.scrollTop += offsetTop;
		} else {
			for(var i = 0; i < focusedElement.length; i++){
				elem[i].scrollLeft += offsetLeft;
				elem[i].scrollTop += offsetTop;
			}
		}
	}
}

function scrollElementTo(elem, offsetLeft, offsetTop){
	if(elem == window){
		window.scrollTo(document.body.scrollWidth * offsetLeft, document.body.scrollHeight * offsetTop);
	} else {
		if(!isArray(elem)){
			elem.scrollLeft = elem.scrollWidth * offsetLeft;
			elem.scrollTop = elem.scrollHeight * offsetTop;
		} else {
			for(var i = 0; i < focusedElement.length; i++){
				elem[i].scrollLeft = elem[i].scrollWidth * offsetLeft;
				elem[i].scrollTop = elem[i].scrollHeight * offsetTop;
			}
		}
	}
}

// Bind keys
function initKeyBind(e){
	if(!allowPassthrough){
		var t = e.target;
		if( t.nodeType == 1){
			if( document.activeElement == null ||
				(textInputs.indexOf(document.activeElement.type) == -1 &&
				document.activeElement.contentEditable != "true") ){

				addKeyBind( 'f', function(){hintMode(0);}, e );
				addKeyBind( 'F', function(){hintMode(1);}, e );
				addKeyBind( ';', function(){hintMode(2);}, e );
				addKeyBind( 'o', function(){inputText(":open ");}, e );
				addKeyBind( 't', function(){inputText(":openTab ");}, e );
				addKeyBind( 'r', function(){window.location.reload(false);}, e );
				addKeyBind( 'R', function(){window.location.reload(true);}, e );
				addKeyBind( ':', function(){inputText(":");}, e );
				addKeyBind( 'y', function(){setClipboard(window.location);}, e );
				addKeyBind( 'e', function(){inputText(":evaluate ");}, e );

				addKeyBind( 'j', function(){scrollElementBy(focusedElement, 0, 50);}, e );
				addKeyBind( 'k', function(){scrollElementBy(focusedElement, 0, -50);}, e );
				addKeyBind( 'h', function(){scrollElementBy(focusedElement, -50, 0);}, e );
				addKeyBind( 'l', function(){scrollElementBy(focusedElement, 50, 0);}, e );

				addKeyBind( 'H', function(){window.history.back();}, e );
				addKeyBind( 'L', function(){window.history.forward();}, e );

				addKeyBind( 'g', function(){scrollTo(focusedElement, 0, 0);}, e );
				addKeyBind( 'G', function(){scrollTo(focusedElement, 0, 1);}, e );

				addKeyBind( 'U', function(){scrollElementBy(focusedElement, 0, -window.innerHeight);}, e );
				addKeyBind( 'D', function(){scrollElementBy(focusedElement, 0, window.innerHeight);}, e );

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
			addKeyBind( 'ArrowUp', function(){prevCommand();}, e );
			addKeyBind( 'ArrowDown', function(){nextCommand();}, e );

			addKeyBind( 'PageUp', function(){scrollInfoBy(-10);}, e );
			addKeyBind( 'PageDown', function(){scrollInfoBy(10);}, e );

		}
		addKeyBind( 'Escape', function(){
			window.top.focus();
			focusedElement = window;
			unfocus();
			unhighlight();
			if(document.webkitIsFullScreen)	{
				document.webkitCancelFullScreen();
			}
		}, e );
	}
	addKeyBind( 'Insert', function(){togglePassthrough();}, e );
}
