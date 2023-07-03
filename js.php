<?php

require_once($_SERVER['DOCUMENT_ROOT'].'/utils/php/net.php');

$JS_PATH = 'javascript';
$LIB_PATH = $JS_PATH.'/libs';

$T_LIB = 'lib';
$T_UTIL = 'util';
$T_UJS = 'ujs';

$MAIN_SCRIPT = 'Loader.js';
$MAIN_SCRIPT_VAR = '_jsUtilsLoader';

$K_IS_SUBSCRIPT = 'is_subscript';
$K_TYPE = 'type';
$K_CAT = 'cat';
$K_SUB_ID = 'subId';
$K_NAME = 'name';
$K_TIME = 'time';
$K_VERSION = 'version';
$K_PATH = 'path';
$K_CONTENT = 'content';
$K_INT_ID = 'intId';
$K_POW_ID = 'powId';
$K_DEPS = 'deps';
$K_COMPILE = 'setCompileDependencies';
$K_LAUNCH = 'setLaunchDependencies';
$K_OPTIONAL = 'setOptionalDependencies';
$K_WEIGHT = 'weight';
$K_COMP_WEIGHT = 'compWeight';
$E_DEPENDENCIES = array($K_COMPILE, $K_LAUNCH, $K_OPTIONAL);

$P_SCRIPT = 's';

$urlRewriting = isset($_SERVER['PATH_INFO']) && (strlen($_SERVER['PATH_INFO']) > 0) && ($_SERVER['PATH_INFO'][0] === '/');
$filepath = $JS_PATH.urldecode($urlRewriting ? $_SERVER['PATH_INFO'] : $_GET[$P_SCRIPT]);

if (preg_match('~^(?:(?:(?<!^)/)?(?!\.\./)[\w:$.-]+?(?=[/.]))+\.js$~', $filepath)) {
	$js = generateJs($filepath, $urlRewriting);
	if ($js !== null) {
		$lastModified = date('D, d M Y H:i:s \G\M\T', max(getlastmod(), $js['filetime']));
		header('Content-Type: application/javascript; charset=utf-8');
		header('Content-Disposition: inline; filename="'.$js['filename'].'"');
		header('Expires: 0');
		header('Cache-Control: must-revalidate');
		header('Pragma: public');
		header('Content-Length: ' . strlen($js['script']));
		header('Last-Modified: ' . $lastModified);
		flush();
		echo $js['script'];
		exit();
	} else if (is_file($filepath)) {
		include($filepath);
	} else {
		exit($filepath.' doesn\'t exist.');
	}
}

function generateJs($filepath, $urlRewriting, $defCat = '.') {
	global $MAIN_SCRIPT, $K_CAT, $K_SUB_ID, $K_NAME, $K_TIME, $K_CONTENT, $K_OPTIONAL;

	$filename = basename($filepath);
	$dirpath = dirname($filepath).'/';
	$scriptname = '';
	if (preg_match('~^((?<name>[^:]+):)?(?<mask>\d+|\*)\.js$~', $filename, $match)) {
		$scriptname = array_key_exists('name', $match) ? $match['name'] : '';
		$masks = array($defCat => $match['mask']);
		$filepath = $dirpath;
	}

	do {
		getScriptFiles($scriptFiles, $filepath, $masks, $unknownDeps);
		$masks = [];
		array_walk($unknownDeps, function($dep) use (&$masks, $K_CAT, $K_OPTIONAL, $K_SUB_ID){
			if (!$dep[$K_OPTIONAL]) {
				$masks[$dep[$K_CAT]] = (array_key_exists($dep[$K_CAT], $masks) ? $masks[$dep[$K_CAT]] : 0) + pow(2, $dep[$K_SUB_ID]);
			}
		});
	} while (!empty($masks));
	if (count($scriptFiles) === 0) return null;
	array_walk($unknownDeps, function($dep) use (&$masks, $K_CAT, $K_OPTIONAL, $K_SUB_ID){
		if (!$dep[$K_OPTIONAL]) {
			error('The mandatory dependency file "'.$dep[$K_CAT].'.'.$dep[$K_SUB_ID].'" could not be found.');
		}
	});

	$hasSubscript = orderDependencies($scriptFiles);
	if ($hasSubscript) {
		defineFileProperties($scriptFiles, $dirpath.$MAIN_SCRIPT, $scriptname);
	}

	$filetime = max(array_map(function($item) use ($K_TIME) { return $item[$K_TIME]; }, $scriptFiles));
	$outJS = '';
	foreach($scriptFiles as &$item) {
		addJSArgs($item);
		$outJS .= "\n".$item[$K_CONTENT];
	}
	$outJS .= $hasSubscript ? "\n".$MAIN_SCRIPT_VAR.'.exec();' : '';

	return array(
		'filename' => $filename,
		'filetime' => $filetime,
		'script' => $outJS
	);
}

function addJSArgs(&$item) {
	global $K_IS_SUBSCRIPT, $K_CAT, $K_SUB_ID, $K_NAME, $K_VERSION, $K_CONTENT;

	if(!empty($item[$K_NAME]) || $item[$K_IS_SUBSCRIPT]) {
		$pos = strrpos($item[$K_CONTENT], "();", -1);
		if ($pos !== false) {
			$name = array_key_exists($K_NAME, $item) ? ($item[$K_NAME] ? '"'.$item[$K_NAME].'"' : 'undefined') : false;
			$args = $name ? $name : ('"'.$item[$K_CAT].'", '.$item[$K_SUB_ID].', "", "'.$item[$K_VERSION].'", '.$MAIN_SCRIPT_VAR.'.Script');
			$item[$K_CONTENT] = substr_replace($item[$K_CONTENT], $args, $pos+1, 0);
		}
	}
}

function getScriptFiles(&$files, $filepath, $masks, &$unknownDeps) {
	if (!$unknownDeps) $unknownDeps = array();
	if (is_file($filepath)) {
		defineFileProperties($files, $filepath, $unknownDeps);
	} else if (is_dir($filepath)) {
		foreach($masks as $cat => $mask) {
			$cat = $cat === '_' ? '.' : $cat;
			$all = '*' === $mask;
			$mask = $all ? '*' : intval($mask);
			$subdir = $filepath.$cat;
			if (is_dir($subdir)) {
				foreach(scandir($subdir, SCANDIR_SORT_NONE) as $filename) {
					$path = $subdir.'/'.$filename;
					if (is_file($path) && preg_match('~^(?<id>\d+)(?=[_.-]).*?\.js$~', $filename, $match)) {
						$id = intval($match['id']);
						if ($all || (pow(2, $id) & $mask)) {
							defineFileProperties($files, $path, $unknownDeps, $cat, $id);
						}
					}
				}
			}
		}
	}
	ksort($files);
}

function defineFileProperties(&$files, $path, &$nameOrUnknownDeps, $cat = null, $id = null) {
	global $K_IS_SUBSCRIPT, $K_CAT, $K_SUB_ID, $K_NAME, $K_TIME, $K_VERSION, $K_PATH, $K_CONTENT, $K_DEPS, $E_DEPENDENCIES;

	$key = $cat === null ? $path : $cat.sprintf('#%05d', $id);
	$time = filemtime($path);
	$item = array($K_TIME => $time, $K_VERSION => date('Ymd.His', $time), $K_PATH => $path, $K_CONTENT => file_get_contents($path), $K_DEPS => array());
	if (is_string($nameOrUnknownDeps)) {
		$item[$K_NAME] = $nameOrUnknownDeps;
		array_splice($files, 0, 0, array(&$item));
	} else {
		$files[$key] = &$item;
	}
	if ($cat !== null) {
		$item[$K_CAT] = $cat;
		$item[$K_SUB_ID] = $id;
	}
	// Test if the script starts with a function definition having "Script" as last argument
	$item[$K_IS_SUBSCRIPT] = preg_match('~^(?:\\s*(?://.*)|\\s*/\\*[\\s\\S]+?\\*/)*\\s*\\([^\\)]+,\\s*Script\\)~', $item[$K_CONTENT]);
	if ($item[$K_IS_SUBSCRIPT]) {
		extractJSValue($E_DEPENDENCIES, $item[$K_CONTENT], $item[$K_DEPS]);
		dispatchDependencies($key, $item[$K_DEPS], $files, $nameOrUnknownDeps);
		//echo print_r($nameOrUnknownDeps, true)."<br/>";
	}
}

function dispatchDependencies($newKey, &$newDeps, &$loadedFiles, &$unknownDeps, $defCat = '.') {
	global $K_TYPE, $K_CAT, $K_SUB_ID, $K_OPTIONAL;

	if (array_key_exists($newKey, $unknownDeps)) {
		unset($unknownDeps[$newKey]);
	}
	foreach($newDeps as $type => &$list) {
		foreach($list as $varName => &$deps) {
			$deps = is_array($deps) ? $deps : array($deps);
			foreach($deps as &$dep) {
				preg_match('~^(?:(?<type>.+?):)?(?:(?<cat>.+?)(?:[/_.-]))?(?<id>\d+)$~', $filename, $match);
				$cat = array_key_exists('cat', $match) ? preg_replace('~^_$~', '.', $match['cat']) : $defCat;
				$id = intval($match['id']);
				$dep = $cat.sprintf('#%05d', $id);
				if (array_key_exists($dep, $loadedFiles)) {
					if (array_key_exists($dep, $unknownDeps)) {
						unset($unknownDeps[$dep]);
					}
				} else {
					if (!array_key_exists($dep, $unknownDeps)) {
						$unknownDeps[$dep] = array($K_CAT => $cat, $K_SUB_ID => $id, $K_OPTIONAL => true);
					}
					$unknownDeps[$dep][$K_OPTIONAL] &= ($type === $K_OPTIONAL);
				}
			}
		}
		unset($deps); // avoid reference problem
		$newDeps[$type] = call_user_func_array('array_merge', array_values($newDeps[$type]));
	}
}

function arrayfyMetadata(&$metadata) {
	foreach($metadata as $prop => &$value) {
		$value = is_array($value) ? $value : array($value);
	}
	unset($value); // avoid reference problem
	return array_keys($metadata);
}

function extractJSValue($varNames, $js, &$result = 0) {
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

	$isArrayInput = is_array($varNames);
	$isArrayOutput = $isArrayInput || is_array($result);
	$pattern = str_replace('$varNames$', $isArrayInput ? join('|', $varNames) : $varNames, $pattern);

	$res = ($result === 0) ? ($isArrayInput ? array() : '') : $result;
	if (!$isArrayOutput && preg_match($pattern, $js, $match)) {
		$res = jsDecode($match['value']);
	} else if ($isArrayOutput && preg_match_all($pattern, $js, $matches, PREG_SET_ORDER)) {
		foreach($matches as $match) {
			$res[$match['name']] = jsDecode($match['value']);
		}
	}
	if ($result !== 0) $result = $res;
	return $res;
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

	return json_decode( preg_replace_callback($pattern, 'jsDecodeMatch', $js ), true );
}

//
// Dependency calculator
//

function refineProps(&$item, &$categories) {
	global $K_IS_SUBSCRIPT, $K_CAT, $K_INT_ID;

	if ($item[$K_IS_SUBSCRIPT] && !array_key_exists($K_INT_ID, $item)) {
		if (!array_key_exists($item[$K_CAT], $categories)) $categories[$item[$K_CAT]] = -1;
		$item[$K_INT_ID] = ++$categories[$item[$K_CAT]];
	}
}

function orderDependencies(&$modules) {
	global $K_IS_SUBSCRIPT, $K_CAT, $K_INT_ID, $K_POW_ID, $K_DEPS;

	$hasSubscript = false;

	$categories = array();
	// Transform the string dependency references to real ones and remove unused optional dependencies
	foreach($modules as &$item) {
		refineProps($item, $categories);
		foreach($item[$K_DEPS] as $type => &$deps) {
			$index = count($deps);
			while($index--) {
				$dep = $deps[$index];
				if (array_key_exists($dep, $modules)) {
					$deps[$index] = &$modules[$dep];
				} else {
					array_splice($deps, $index, 1);
				}
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
	foreach($modules as &$item) {
		if ($item[$K_IS_SUBSCRIPT]) {
			$hasSubscript |= true;
			$item[$K_POW_ID] = pow(2, $categories[$item[$K_CAT]] + $item[$K_INT_ID]);
		}
	}

	// Calculate the weight of each dependency in order to know which one should go first
	foreach($modules as &$item) {
		setDependencyWeight($item);
	}

	// Sort the dependencies
	uasort($modules, 'dependencyComparator');
	//print_r(array_keys($modules));
	//echo '<pre>'.generateDepsGraph($modules).'</pre>';

	return $hasSubscript;
}

function setDependencyWeight(&$item, $weight = 0, $compWeight = 0) {
	global $K_POW_ID, $K_DEPS, $K_COMPILE, $K_WEIGHT, $K_COMP_WEIGHT;

	$item[$K_WEIGHT] = array_key_exists($K_WEIGHT, $item) ? $item[$K_WEIGHT] : 0;
	$item[$K_COMP_WEIGHT] = array_key_exists($K_COMP_WEIGHT, $item) ? $item[$K_COMP_WEIGHT] : 0;

	$loop = $weight & $item[$K_POW_ID];
	$compLoop = $compWeight & $item[$K_POW_ID];

	$oldWeight = $item[$K_WEIGHT];
	$item[$K_WEIGHT] = ($loop ? $weight ^ $item[$K_POW_ID] : $weight) | $item[$K_WEIGHT];
	$item[$K_COMP_WEIGHT] = ($compLoop ? $compWeight ^ $item[$K_POW_ID] : $compWeight) | $item[$K_COMP_WEIGHT];

	if ($compLoop) {
		error('Loop detected in compile dependencies!');
	}
	if ($weight === 0 || $oldWeight !== $item[$K_WEIGHT]) {
		foreach($item[$K_DEPS] as $type => &$deps) {
			foreach($deps as &$dep) {
				setDependencyWeight($dep, $item[$K_WEIGHT] | $item[$K_POW_ID], $type === $K_COMPILE ? $item[$K_COMP_WEIGHT] | $item[$K_POW_ID] : 0);
			}
		}
	}
}

function dependencyComparator($d1, $d2) {
	global $K_POW_ID, $K_WEIGHT, $K_COMP_WEIGHT;

	$res = $d2[$K_COMP_WEIGHT] - $d1[$K_COMP_WEIGHT];
	$res = $res ? $res : $d2[$K_WEIGHT] - $d1[$K_WEIGHT];
	return $res ? $res : $d1[$K_POW_ID] - $d2[$K_POW_ID];
}

function graphItem($item) {
	global $K_CAT, $K_SUB_ID, $K_POW_ID, $K_WEIGHT, $K_COMP_WEIGHT;

	return '"'.$item[$K_CAT].'-'.$item[$K_SUB_ID].' ['.$item[$K_POW_ID].', '.$item[$K_WEIGHT].', '.$item[$K_COMP_WEIGHT].']"';
}

function generateDepsGraph($modules) {
	global $K_DEPS;

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

?>