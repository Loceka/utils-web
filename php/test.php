<?php

function extractJSValue($varNames, $js) {
	// Nowdoc notation : prevent variable replacement (similar to '$var')
	$pattern = <<<'EOD'
~
(?(DEFINE)
	(?<quotedstr> (?<quote>["'])(?<string>(?:(?!\k<quote>)[^\r\n\\]|\\++(?!\k<quote>)|\\(?:\\\\)*+\k<quote>)*+)\k<quote> )
)

(\[)?(["']?)\b(?<name>$varNames$)\g{-2}(?(-3)\])\s*(?:(?<func>\()|[:=])
\s*(?<value>
	\g<quotedstr>
	| {(?:[^{}"']|\g<quotedstr>|(?&value))*}
	| \[(?:[^\[\]"']|\g<quotedstr>|(?&value))*\]
)(?(func)\s*\))

~xJ
EOD;

	$isArray = is_array($varNames);
	$pattern = str_replace('$varNames$', $isArray ? join('|', $varNames) : $varNames, $pattern);

	if (!$isArray && preg_match($pattern, $js, $match)) {
		return jsDecode($match['value']);
	} else if ($isArray && preg_match_all($pattern, $js, $matches, PREG_SET_ORDER)) {
		$res = array();
		foreach($matches as $match) {
			$res[$match['name']] = jsDecode($match['value']);
		}
		return $res;
	}
}

function jsDecodeMatch($match) {
	$unescapedQuote = '~((?<!\\\\)(?:\\\\\\\\)*+")~';
	return '"' . (isset($match['quote']) && $match['quote'] == '\'' ? preg_replace($unescapedQuote, '\\\\$1', $match['string']) : $match['string']) . '"';
}

function jsDecode($js) {
	// Nowdoc notation : prevent variable replacement (similar to '$var')
	$pattern = <<<'EOD'
~
(?(DEFINE)
	(?<keystr> [a-zA-Z$_][a-zA-Z0-9$_]* )
)

(?:^|[{[:,])\s* \K (?<quote>["'])(?<string>(?:(?!\k<quote>)[^\r\n\\]|\\++(?!\k<quote>)|\\(?:\\\\)*+\k<quote>)*+)\k<quote>
|
[{,]\s* \K (?<string>\g<keystr>) (?=\s*:)

~xJ
EOD;

	$res = preg_replace_callback($pattern, 'jsDecodeMatch', $js );
	return json_decode( $res, true );
}

function testRef(&$outArray = 0) {
	$fileContent = stripslashes('2048;0');
	if ($outArray !== 0) {
		echo "doing buildArray\n";
		foreach(preg_split("/\n/", $fileContent, -1, PREG_SPLIT_NO_EMPTY) as $l) {
			list($pos, $content) = preg_split('/;/', $l, 2);
			$pos = preg_split('/,/', $pos);
			buildArray($outArray, $pos, $content);
		}
	}
	return $fileContent;
}
function buildArray(&$array, $pos, $content) {
	if (count($pos) > 1) {
		$p = array_shift($pos);
		buildArray($array[$p], $pos, $content);
	} else {
		$array[$pos[0]] = $content;
	}
}

$K_CAT = 'cat';
$K_SUB_ID = 'subId';
$K_INT_ID = 'intId';
$K_POW_ID = 'powId';
$K_POW_SUB_ID = 'powSubId';
$K_NAME = 'name';
$K_DEPS = 'deps';
$K_LAUNCH = 'launch';
$K_COMPILE = 'compile';
$K_WEIGHT = 'weight';
$K_COMP_WEIGHT = 'compWeight';

function graphItem($item) {
	global $K_CAT, $K_SUB_ID, $K_INT_ID, $K_POW_ID, $K_POW_SUB_ID, $K_NAME, $K_DEPS, $K_LAUNCH, $K_COMPILE, $K_WEIGHT, $K_COMP_WEIGHT;

	return '"'.$item[$K_NAME].' ['.$item[$K_POW_ID].', '.$item[$K_WEIGHT].', '.$item[$K_COMP_WEIGHT].']"';
}

function generateDepsGraph($modules) {
	global $K_CAT, $K_SUB_ID, $K_INT_ID, $K_POW_ID, $K_POW_SUB_ID, $K_NAME, $K_DEPS, $K_LAUNCH, $K_COMPILE, $K_WEIGHT, $K_COMP_WEIGHT;

	$graph = 'digraph G {';
	foreach(array_reverse($modules) as $name => $props) {
		if ($props[$K_DEPS]) {
			foreach($props[$K_DEPS] as $type => $deps) {
				foreach($deps as $dep) {
					$graph .= "\n\t".graphItem($props).' -> '.graphItem($dep);
				}
			}
		} else {
			$graph .= "\n\t".graphItem($props);
		}
	}
	$graph .= "\n".'}';
	return $graph;
}

function setDependencyWeight(&$item, $weight = 0, $compWeight = 0) {
	global $K_CAT, $K_SUB_ID, $K_INT_ID, $K_POW_ID, $K_POW_SUB_ID, $K_NAME, $K_DEPS, $K_LAUNCH, $K_COMPILE, $K_WEIGHT, $K_COMP_WEIGHT;

	$item[$K_WEIGHT] = array_key_exists($K_WEIGHT, $item) ? $item[$K_WEIGHT] : 0;
	$item[$K_COMP_WEIGHT] = array_key_exists($K_COMP_WEIGHT, $item) ? $item[$K_COMP_WEIGHT] : 0;

	$loop = $weight & $item[$K_POW_ID];
	$compLoop = $compWeight & $item[$K_POW_ID];
	echo 'powId = '.$item[$K_POW_ID].', curWeight = '.$item[$K_WEIGHT].', argWeight = '.$weight;
	$oldWeight = $item[$K_WEIGHT];
	$item[$K_WEIGHT] = ($loop ? $weight ^ $item[$K_POW_ID] : $weight) | $item[$K_WEIGHT];
	$item[$K_COMP_WEIGHT] = ($compLoop ? $compWeight ^ $item[$K_POW_ID] : $compWeight) | $item[$K_COMP_WEIGHT];
	echo ', newWeight = '.$item[$K_WEIGHT]."\n";

	if ($compLoop) {
		//TODO : throw error if compile dep
		echo "ERROR : LOOP DETECTED IN COMPILE DEPENDENCIES!\n";
	}
	if ($weight === 0 || $oldWeight !== $item[$K_WEIGHT]) {
		foreach($item[$K_DEPS] as $type => &$deps) {
			foreach($deps as &$dep) {
				setDependencyWeight($dep, $item[$K_WEIGHT] | $item[$K_POW_ID], $type === $K_COMPILE ? $item[$K_COMP_WEIGHT] | $item[$K_POW_ID] : 0);
			}
		}
	}
}

function defineProps(&$item, $name, &$categories) {
	global $K_CAT, $K_SUB_ID, $K_INT_ID, $K_POW_ID, $K_POW_SUB_ID, $K_NAME, $K_DEPS, $K_LAUNCH, $K_COMPILE, $K_WEIGHT, $K_COMP_WEIGHT;

	if (!$item || !array_key_exists($K_CAT, $item)) {
		preg_match('/^(.+?)(\d+)$/', $name, $match);
		$item[$K_CAT] = $match[1];
		$item[$K_SUB_ID] = intval($match[2]) - 1;
		$item[$K_NAME] = $name;
		$item[$K_POW_SUB_ID] = pow(2, $item[$K_SUB_ID]);
		if (!array_key_exists($K_DEPS, $item)) $item[$K_DEPS] = array();

		if (!array_key_exists($item[$K_CAT], $categories)) $categories[$item[$K_CAT]] = -1;
		$item[$K_INT_ID] = ++$categories[$item[$K_CAT]];
	}
}

function testDependencies() {
	global $K_CAT, $K_SUB_ID, $K_INT_ID, $K_POW_ID, $K_POW_SUB_ID, $K_NAME, $K_DEPS, $K_LAUNCH, $K_COMPILE, $K_WEIGHT, $K_COMP_WEIGHT;

	$modules = array(
		".1" => array($K_DEPS => array($K_LAUNCH => array("_1"), $K_COMPILE=>array("d1"))),
		"_1" => array($K_DEPS => array($K_LAUNCH => array("_3", "d1"))),
		"_3" => array($K_DEPS => array($K_LAUNCH => array("d1", "d2"))),
		"d1" => array($K_DEPS => array($K_LAUNCH => array("d2", "d3"))),
		"d2" => array($K_DEPS => array($K_LAUNCH => array("_1"))),
		"d3" => array($K_DEPS => array($K_COMPILE => array("e1"))),
		//"e1" => array($K_DEPS => array($K_COMPILE => array(".1"))),
		"e2" => array()
	);
	ksort($modules);

	$categories = array();
	// Transform the string dependency references to real ones
	foreach($modules as $name => &$props) {
		defineProps($props, $name, $categories);
		foreach($props[$K_DEPS] as $type => &$deps) {
			foreach($deps as $index => &$item) {
				if (!array_key_exists($item, $modules)) {
					defineProps($modules[$item], $item, $categories);
				}
				$deps[$index] = &$modules[$item];
			}
		}
	}

	// Sets the starting id of each category [0, lastMax+1, lastMax+1, ...]
	ksort($categories);
	$lastCat = -1;
	foreach($categories as $cat => &$maxId) {
		$lastCat += $maxId + 1;
		$maxId = $lastCat - $maxId;
	}

	// Compute the id of each dependency : 2^(catId + depId)
	foreach($modules as $name => &$item) {
		$item[$K_POW_ID] = pow(2, $categories[$item[$K_CAT]] + $item[$K_INT_ID]);
	}

	// Calculate the weight of each dependency in order to know which one should go first
	foreach($modules as $name => &$item) {
		setDependencyWeight($item);
	}

	// Sort the dependencies
	uasort($modules, 'dependencyComparator');
	print_r(array_keys($modules));

	return generateDepsGraph($modules);
}

function dependencyComparator($d1, $d2) {
	global $K_CAT, $K_SUB_ID, $K_INT_ID, $K_POW_ID, $K_POW_SUB_ID, $K_NAME, $K_DEPS, $K_LAUNCH, $K_COMPILE, $K_WEIGHT, $K_COMP_WEIGHT;

	$res = $d2[$K_COMP_WEIGHT] - $d1[$K_COMP_WEIGHT];
	$res = $res ? $res : $d2[$K_WEIGHT] - $d1[$K_WEIGHT];
	return $res ? $res : $d1[$K_POW_ID] - $d2[$K_POW_ID];
}

	$js = <<<'EOD'
(Script, autoVersion) => {
	const obj1 = {
		name: "test-userjs",
		include: [
			"https://www.go{ogle.com*",
			"https://www.you[tu]be.com*"
		],
		grant: "none",
		connect: 'loceka.free.fr',
		"run-at": "document-start"
	};
	const arr1 = [
		"value \"1\""
		, "value [2",
		"value 3"
	];
	func1(["a", 'b']);

	test.obj2 = {"obj2 key": 'obj2 val'};
	test.arr2 = [];
	test.func2({});

	test["obj3"] = "string obj 3";
	test['arr3'] = [];
	test["func3"]('func3');

	test {
		obj4: {},
		arr4: [],
	}

	const self = new Script("name", autoVersion, "description")
		.lastSupportedVersion("2018*")
	;

	return self;
}
EOD;


echo '<pre>';
echo PHP_INT_MAX."\n";
echo log(PHP_INT_MAX, 2)."\n";
echo testDependencies();
echo '</pre>';

/*
echo '<pre>';;
echo testRef()."\n\n";
echo testRef($array)."\n\n";
echo testRef($array)."\n";
var_dump($array);
echo '</pre>';
*/

/*
echo '<pre>';
echo $js."\n\n";

$asArray = array();
for ($i = 1; $i <= 4; $i++) {
	foreach(array('obj', 'arr', 'func') as $extract) {
		$v = $extract.$i;
		$asArray[] = $v;
		$res = extractJSValue($v, $js);
		echo $v . ' => ' .  (json_last_error() == JSON_ERROR_NONE ? '['.gettype($res).', '.($res === null).'] '.print_r($res, true) : 'error')."\n";
	}
}
echo print_r(extractJSValue($asArray, $js), true)."\n\n\n";
echo '</pre>';
*/
?>