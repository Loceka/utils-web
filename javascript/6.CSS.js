/**
 * Script loader
 *
 * @param {?(string|object)} [name=<script data-var>] the property name in the current context (which probably is window) where this script should be written to.
 *                                                     - if <varName> is an object, it will be used as the code container.
 *                                                     - if <varName> is undefined or null, the code is directly injected in the current context (window or this) instead of being embedded in a single object.
 *                                                     - if <varName> is otherwise false or empty, the object containing the code is only returned by the function, not placed in any context.
 *                                                     - if <varName> already exists in the context, it is reused and current code is merged into it.
 */
((cat, id, varName = document?.currentScript?.dataset?.var, autoVersion, Script) => {
	const curScript = (varName === undefined || varName === null) ? this : (varName ? (typeof varName === "object" ? varName : this[varName]??{}) : {});
	if (varName && (typeof varName === "string")) this[varName] = curScript;

	Script = Script || ((typeof _jsUtilsLoader === "undefined" || !_jsUtilsLoader) ? varName?._jsUtilsLoader : _jsUtilsLoader)?.Script;
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
