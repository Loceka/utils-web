<?php
require_once($_SERVER['DOCUMENT_ROOT'].'/utils/php/io.php');

function error($msg, $code = 400, $text='Bad Request') {
	header($_SERVER['SERVER_PROTOCOL'].' '.$code.' '.$text.($msg ? ': '.$msg : ''), true, 400);
	die();
}

function rest($base64Json = false, $firstOptionalPathIndex = 0, $associatedGetParams = array(), $funcAdditionalArgs = null) {
	$usePathInfo = isset($_SERVER['PATH_INFO']) && (strlen($_SERVER['PATH_INFO']) > 0) && ($_SERVER['PATH_INFO'][0] === '/');
	$pathArgs = $usePathInfo ? explode('/', substr($_SERVER['PATH_INFO'], 1)) : array();
	array_walk($associatedGetParams, function($v, $i) use (&$pathArgs) {
		$pathArgs[$i] = (array_key_exists($i, $pathArgs) && $pathArgs[$i]) ? $pathArgs[$i] : (isset($_GET[$v]) ? $_GET[$v] : "");
	});
	$pathArgs = array_filter($pathArgs, function($v, $i) use ($firstOptionalPathIndex) {return $i < $firstOptionalPathIndex || $v;}, ARRAY_FILTER_USE_BOTH);

	$method = strtolower($_SERVER['REQUEST_METHOD']);
	$args = array_merge(array(&$pathArgs), (in_array($method, array('post', 'put')) ? array(getPostOrInputData()) : array()), $funcAdditionalArgs ? $funcAdditionalArgs($pathArgs) : array());
	$jsonResponse = encodeJSON(call_user_func_array('do_'.$method, $args), $base64Json);

	header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
	header("Cache-Control: post-check=0, pre-check=0", false);
	header("Pragma: no-cache");
	if(!empty($_GET['callback'])) {
		header("Content-Type: application/javascript");
		echo $_GET['callback'].'('.$jsonResponse.')';
	} else {
		header("Content-Type: application/json");
		echo $jsonResponse;
	}
}

function getPostOrInputData() {
	$input_params = file_get_contents("php://input");
	$data = null;
	if (!empty($_POST)) {
		$data = $_POST;
	} else if (strlen($input_params) > 0) {
		$data = decodeJSON($input_params);
		if (json_last_error() !== JSON_ERROR_NONE) {
			// invalid JSON
			error('Invalid JSON', 422, 'Unprocessable JSON Entity');
		}
	}
	return $data;
}
?>