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
 *     <script type="text/javascript" data-var="util" src="6.CSS.js"></script>
 */
((cat, id, varName = document?.currentScript?.dataset?.var, autoVersion, Script) => {
	const curScript = (varName === undefined || varName === null) ? this : (varName ? (typeof varName === "object" ? varName : this[varName]??{}) : {});
	if (varName && (typeof varName === "string")) this[varName] = curScript;

	Script = Script || ((typeof _jsUtilsLoader === "undefined" || !_jsUtilsLoader) ? curScript?._jsUtilsLoader : _jsUtilsLoader)?.Script;
	const _ = Script ? new Script(id, autoVersion) : {
		setLaunchDependencies(deps) { Object.keys(deps).forEach(k => { this[k] = Object.assign(curScript, window[k] ?? (curScript !== window) ? window : {} ); }); },
		content(content) { return content; }
	};
	_.setLaunchDependencies({
		"u": 0
	});

	let customSheet;
	return Object.assign(curScript, _.content({
        customStylesheet(stylesheetId = "customAddedStylesheet") {
			if (!customSheet) {
				document.head.insertAdjacentHTML('beforeend', `<style id="${stylesheetId}" type="text/css"></style>`);
				customSheet = document.getElementById(stylesheetId)?.sheet;
			}
			return customSheet;
        },
		// Choose between dark and light mode themes (it still needs to be implemented CSS side by declaring variables in :root[data-theme="dark"]{} and :root[data-theme="light"]{})
		selectTheme() {
			const selectMode = (e) => document.documentElement.dataset.theme = e.matches ? "dark" : "light";
			const matchDarkScheme = window.matchMedia?.("(prefers-color-scheme: dark)");
			selectMode(matchDarkScheme);
			matchDarkScheme?.addEventListener("change", selectMode);

			const preferedMode = new URLSearchParams(window.location.search).get("theme");
			if (["dark", "light"].includes(preferedMode)) {
				selectMode({matches: "dark" === preferedMode});
			}
		},
        customRule(ruleSelector, content) {
			const sheet = this.customStylesheet();
			let selectedIndex;
			let selectedRule = [...sheet.cssRules].find((r, i) => r.selectorText === ruleSelector && (selectedIndex = i) !== undefined);

			if (content !== undefined) {
				if (selectedIndex !== undefined) {
					sheet.deleteRule(selectedIndex);
					selectedRule = undefined;
				}
				if (content) {
					sheet.insertRule(`${ruleSelector} { ${content} }`, selectedIndex ?? sheet.cssRules.length);
					selectedRule = sheet.cssRules[sheet.cssRules.length-1];
				}
			}

			return selectedRule?.style;
		},
		getStyle(el, styleProp) {
			const defaultView = (el.ownerDocument ?? document).defaultView;
			let value;
			if (defaultView && defaultView.getComputedStyle) {
				// sanitize property name to css notation (hypen separated words eg. font-Size)
				styleProp = styleProp.replace(/(?<!-)([A-Z])/g, "-$1").toLowerCase();
				value = defaultView.getComputedStyle(el, null).getPropertyValue(styleProp);
			}
			return value;
		},
	}));
})();
