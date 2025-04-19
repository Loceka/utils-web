/**
 * Script loader
 * 
 * Start the script with : [scriptName].launchScript().then(process);
 *
 * @param {?(string|object)} [name=<script data-var>] : the property name in the current context (which probably is window) where this script should be written to.
 *     - if <varName> is an object, it will be used as the code container.
 *     - if <varName> is undefined or null, the code is directly injected in the current context (window or this) instead of being embedded in a single object.
 *     - if <varName> is otherwise false or empty, the object containing the code is only returned by the function, not placed in any context.
 *     - if <varName> already exists in the context, it is reused and current code is merged into it.
 * 
 * @param {?(number|string)} [name=<script data-load>] : the script(s) to load - comma separated list
 *     - it can be either the script name (eg. 0.type_assign.js) or just its ID (eg. 0)
 * 
 * Examples :
 *   load the script in window.u with 2 sub scripts (0 => 0.type_assign.js and 1 => 1.DOM.js):
 *     <script type="text/javascript" src="/utils/javascript/Loader.js" data-var="u" data-load="0, 1"></script>
 * 
 *   load the script directly in window with 1 declared sub script (3.net.js => 3) which will load 0.type_assign.js as a dependency:
 *     <script type="text/javascript" src="/utils/javascript/Loader.js" data-load="3.net.js"></script>
 * 
 *   to allow loading local script on windows it is necessary to add the following line in addition to - and just after - the previous script declaration:
 *     <script type="text/javascript" data-drive="/C:">if (typeof _jsUtilsLoader === "undefined") document.write(document.querySelector("script[data-load]")?.outerHTML.replace(/(?<=src=(["']))(?:\/\w:(?=\/))?([^\1]+)/, document.currentScript.dataset.drive + "$2"));</script>
 *     it may also be wise to create a junction (symbolic link) to the "utils" directory at the start of the drive.
 * 
 *   load only this script without using Loader.js:
 *     <script type="text/javascript" data-var="util" src="1.DOM.js"></script>
 */
((cat, id, varName = document?.currentScript?.dataset?.var, autoVersion, Script) => {
	const curScript = (varName === undefined || varName === null) ? this : (varName ? (typeof varName === "object" ? varName : this[varName]??{}) : {});
	if (varName && (typeof varName === "string")) this[varName] = curScript;

	Script = Script || ((typeof _jsUtilsLoader === "undefined" || !_jsUtilsLoader) ? curScript?._jsUtilsLoader : _jsUtilsLoader)?.Script;
	const _ = Script ? new Script(id, autoVersion) : {
		setLaunchDependencies(deps) { Object.keys(deps).forEach(k => { this[k] = Object.assign(curScript, window[k] ?? (curScript !== window) ? window : {} ); }); },
		content(content) { return content; }
	};

	Node.prototype.querySelectorArray = function() {
		return Array.from(this.querySelectorAll.apply(this, Array.from(arguments)));
	}

	const renameBoundingClientRect = ({x:relX, y:relY, top:relTop, right:relRight, bottom:relBottom, left:relLeft, height, width}) => ({relX, relY, relTop, relRight, relBottom, relLeft, height, width});
	return Object.assign(curScript, _.content({
		getAncestorOrSelf(elem, nodeNames, classNames) {
			classNames = (classNames && typeof classNames === "object") ? (Array.isArray(classNames) ? classNames : Object.keys(classNames)) : [classNames ? classNames : ".*"];
			nodeNames = (nodeNames && typeof nodeNames === "object") ? (Array.isArray(nodeNames) ? nodeNames : Object.keys(nodeNames)) : [nodeNames ? nodeNames : ".*"];
			var classRE = new RegExp("\\b(?:" + classNames.join("|") + ")\\b"), nodeRE = new RegExp("^(?:" + nodeNames.join("|") + ")$", "i");
			while(elem && (!nodeRE.test(elem.nodeName || "") || !classRE.test(elem.className || "_"))) elem = elem.parentElement;
			return elem;
		},
		getChildIndex(elem, startIndex = 0, elemOfType = "*") {
			elemOfType = (typeof elemOfType === "boolean") ? (elemOfType ? elem.nodeName || "*" : "*") : elemOfType;
			let childNodes = elem ? elem.parentElement.querySelectorAll(":scope>" + elemOfType) : [];
			for (let i = startIndex, child; child = childNodes[i-startIndex]; i++) {
				if (child === elem) {
					return i;
				}
			}
			return -1;
		},
		getNodePath(elem, startPath) {
			let path = [], start = startPath ? document.querySelector(startPath) : document;
			if (elem && start) {
				for (let child = elem, parent; (child !== start) && (parent = child.parentElement); child = parent){
					path.push(">" + (child.nodeName||"*") + ":nth-of-type(" + getChildIndex(child, 1, true) + ")");
					if (!startPath && parent.id) {
						startPath = "#" + parent.id;
						start = parent;
					}
				}
				path.push(startPath || "html");
			} else {
				console.log("Erreur: getNodePath: aucun élément trouvé pour elem: '" + elem + "' ou startPath: '" + startPath + "'");
			}
			return start && path.reverse().join("");
		},
		//
		// Mouse and element positions
		//
		getPosX(ev) { ev = ev||window.event; return ev.pageX ? ev.pageX : ev.clientX + document.body.scrollLeft + document.documentElement.scrollLeft; },
		getPosY(ev) { ev = ev||window.event; return ev.pageY ? ev.pageY : ev.clientY + document.body.scrollTop + document.documentElement.scrollTop; },
		getElemX(elem) {
			let elemX = elem.offsetLeft;
			while (elem = elem.offsetParent) {
				elemX += elem.offsetLeft;
			}
			return elemX;
		},
		getElemY(elem) {
			let elemY = elem.offsetTop;
			while (elem = elem.offsetParent) {
				elemY += elem.offsetTop;
			}
			return elemY;
		},
		getElemBounds(elem) {
			const bounds = renameBoundingClientRect(elem.getBoundingClientRect());
			bounds.x = bounds.left = Math.floor(bounds.relX + window.scrollX);
			bounds.y = bounds.top = Math.floor(bounds.relY + window.scrollY);
			bounds.right = Math.floor(bounds.relRight + window.scrollX);
			bounds.bottom = Math.floor(bounds.relBottom + window.scrollY);
			return bounds;
		},
	}));
})();
