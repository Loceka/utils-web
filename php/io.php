<?php
function transformString($struct, $transformer) {
	$res = $struct;
	switch(gettype($struct)) {
		case 'string':
			$res = $transformer($struct);
			break;
		case 'array':
			foreach($res as $key => $value) {
				$res[$key] = transformString($value, $transformer);
			}
			break;
	}
	return $res;
}

function encodeJSON($struct, $base64Json = false) {
	return $base64Json ? json_encode(transformString($struct, 'base64_encode')) : json_encode($struct);
}
function decodeJSON($struct, $base64Json = false) {
	return $base64Json ? transformString(json_decode($struct, true), 'base64_decode'): json_decode($struct, true);
}

/* Read the data file and set the content to the given array */
function readFromFile($file, &$outArray = 0) {
	$fileContent = '';
	if (file_exists($file) && ($handle = @fopen($file, 'r'))) {
		flock($handle, LOCK_SH);
		$fileContent = stream_get_contents($handle);
		flock($handle, LOCK_UN);
		fclose($handle);

		if ($outArray !== 0) {
			$fileContent = stripslashes($fileContent);
			foreach(preg_split("/\n/", $fileContent, -1, PREG_SPLIT_NO_EMPTY) as $l) {
				list($pos, $content) = preg_split('/;/', $l, 2);
				$pos = preg_split('/,/', $pos);
				buildArray($outArray, $pos, $content);
			}
		}
	} else if ($outArray !== 0 && $outArray === null) {
		$outArray = array();
	}
	return $fileContent;
}

/* Write a data file with the content of the given array */
function writeToFile($file, $data, $mode='c') {
	$data = is_array($data) ? buildString($data) : $data;
	if (!empty($data)) {
		if (!is_dir(dirname($file))) {
			mkdir(dirname($file), 0777, true);
		}

		$handle = @fopen($file, $mode);
		flock($handle, LOCK_EX);
		if ($mode === 'c') {
			ftruncate($handle, 0);
		}
		fwrite($handle, $data);
		flock($handle, LOCK_UN);
		fclose($handle);
	}
}

/* Create an array from a file content string */
function buildArray(&$array, $pos, $content) {
	if (count($pos) > 1) {
		$p = array_shift($pos);
		buildArray($array[$p], $pos, $content);
	} else {
		$array[$pos[0]] = $content;
	}
}

/* Create a file content string from an array */
function buildString($array, $keys='') {
	$line = '';
	foreach($array as $k => $v) {
		if (is_array($v)) {
			$line .= buildString($v, $keys.$k.',');
		} else {
			$line .= $keys.$k.';'.$v."\n";
		}
	}
	return $line;
}

function logText($data, $file='log.txt', $mode='a') {
	writeToFile($file, date('y/m/d H:i:s').' - '.$data, $mode);
}
?>