const testUrl = new URL(window.location.href);
const searchParams = testUrl.searchParams;
const mainFunc = "main", testParams = {testStep: "", testFunc: mainFunc};
Object.keys(testParams).forEach(k => testParams[k] = testUrl.searchParams.get(k) || testParams[k]);
const isSubTest = testParams.testStep || (testParams.testFunc !== mainFunc);
let subTestLoaded, testedFeature;

window.addEventListener('load', async () => {
	try {
		const result = await window[testParams.testFunc](testParams.testStep);
		if (isSubTest) {
			postToMainTest({loaded: true, result});
		}
	} catch (e) {
		testResult(testParams.testStep, {message: "unexpected " + e.name + ": " + e.message});
		throw e;
	}
});

window.addEventListener('message', event => {
	/*
	if (isSubTest) {
		console.log(`[sub test ${testItem}] message received from main test:`, event.data);
	} else
	*/
	if (event.data.loaded) {
		//console.log("[" + (testParams.testStep || "main") + "] loaded : " + event.data.from.testStep);
		subTestLoaded?.(event.data.result);
	} else if (event.data.result !== undefined) {
		//console.log("[" + (testParams.testStep || "main") + "] result : " + event.data.from.testStep);
		testResult(event.data.testStep, event.data.result, event.data.from.testStep);
	}
});

async function genericTest(main, catchErrors, step, test, ...args) {
	try {
		await test(step, ...args);
		if (main) {
			await testResult(step, false);
		}
	} catch(e) {
		if (e.message !== "testAssertError") {
			if (catchErrors) {
				testResult(step, {message: "unexpected " + e.name + ": " + e.message});
			}
			throw e;
		}
	}
	
}

const doTest = genericTest.bind(null, true, true);
const redoTest = genericTest.bind(null, false, true);
const doTestThrow = genericTest.bind(null, true, false);
const redoTestThrow = genericTest.bind(null, false, false);

function objectToString(o) {
	return JSON.stringify(o, (k, v) => util.typeOf(v).smartSwitch({function: f => `__${f.name}__`, undefined: '__undefined__', default: v => v})).replaceAll(/"__(\w+)__"/g, "$1");
}

function testAssertNot(step, actual, expected, message, unordered) {
	return testAssert(step, actual, expected, message, unordered, true);
}

function testAssert(step, actual, expected, message, unordered, assertNotEqual) {
	if (assertNotEqual ? util.equal(actual, expected, unordered) : !util.equal(actual, expected, unordered)) {
		console.error([testParams.testStep, testedFeature, step].filter(s => s).join(".") + " => actual:", actual, ", expected:", expected);
		[actual, expected] = [actual, expected].map(objectToString);
		testResult(step, {actual, expected: (assertNotEqual ? "not " : "") + expected, message: message.replace(/<([^>]+)>/, "<code>$1</code>")});
		throw new Error("testAssertError");
	}
}

function testResult(step, error) {
	step = [testParams.testStep, testedFeature, step.replace(new RegExp("^"+(testedFeature ?? "")+"\\."), "")].filter(s => s).join(".");
	if (isSubTest) {
		postToMainTest({testStep: step, result: error});
	} else {
		const resultElem = getResultsElem();
		let {actual, expected, message} = error || {};
		const text = error ? (message ? message + " - " : "") + "actual : " + actual + " ; expected : " + expected : "OK";
		//console.log(`${step}: ${text}`);
		const errorElems = error ? `<div class="message">${message}</div><div class="expected">${expected}</div><div class="actual">${actual}</div>` : "";
		resultElem.insertAdjacentHTML('beforeend', `<div class="result ${error ? "error" : "success"}"><div class="step">${step}</div>${errorElems}</div>`)
		groupResults();
	}
}

function getResultsElem() {
	let resultElem = document.getElementById("results");
	if (!resultElem) {
		resultElem = (document.body.insertAdjacentHTML('afterbegin', '<div id="results"></div>'), document.body.firstChild);
		resultElem.insertAdjacentHTML('afterbegin', '<div class="toggle" onclick="results.classList.toggle(\'hideSuccessful\')">Show/Hide successful tests</div>');
	}
	return resultElem;
}

function groupResults() {
	const resultsElem = document.getElementById("results");
	[...resultsElem.querySelectorAll(".result:not(.grouped)")].forEach(resultElem => {
		const stepElem = resultElem.querySelector(".step");
		const steps = stepElem.textContent.split(".");
		stepElem.textContent = steps.pop();

		let container = resultsElem;
		let stepPath = "";
		steps.forEach(step => {
			stepPath += (stepPath ? "." : "") + step;
			container = document.getElementById("step_"+stepPath) ?? (container.insertAdjacentHTML("beforeend", `<div id="step_${stepPath}" class="group"><label onclick="this.parentElement.classList.toggle('hidden')">${step}</label></div>`), container.lastChild);
		});
		container.appendChild(resultElem);
		resultElem.classList.add("grouped");
	});
}

function postToSubTest(subIFrame, data, toAllSubTest = false) {
	if (toAllSubTest) {
		subIFrame.addEventListener('load', () => {
			subIFrame.contentWindow?.postMessage(data, '*');
		});
	}
	subIFrame.contentWindow?.postMessage(data, '*');
}

function postToMainTest(data) {
	data.from = testParams;
	parent?.postMessage(data, '*');
}

function createSubTest(subTestUrl, step, func) {
	subTestUrl = new URL(subTestUrl ?? "", location.href);
	subTestUrl.searchParams.set("testStep", step);
	subTestUrl.searchParams.set("testFunc", func?.name ?? func ?? "");

	const subTestFrame = document.getElementById("subTestFrame");

	return new Promise(resolve => {
		subTestLoaded = resolve.bind(null, subTestFrame);
		subTestFrame.src = subTestUrl.href;
	});
}

function sleep(ms) {
	return new Promise(resolve => window.setTimeout(resolve, ms));
}
