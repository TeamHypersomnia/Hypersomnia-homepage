<?php

$errors= array();

require_once __DIR__.'/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__.'/../');
$dotenv->load();

$version = $_POST["version"];
$BUILDS_DIR = "builds";
$target_folder = $BUILDS_DIR."/".$version;
$latest_symlink_name = "latest";

if (!isset($_POST["version"])) {
	$errors[]="Version is not set!";
}

if ($_POST["version"] == "_") {
	$errors[]="Version is set to _!";
}

if ($_ENV["ARTIFACT_UPLOAD_KEY"] != $_POST["key"]) {
	$errors[]="Key does not match!\nSent key:".$_POST["key"];
}

if ($version == "last" || $version == "last_uploaded") {
	$last_uploaded_version_path = $BUILDS_DIR."/last_uploaded_version.txt";
	$version = file_get_contents($last_uploaded_version_path);

	if ($version == false) {
		$errors[]=$last_uploaded_version_path." not exist!";
	}
}

if (empty($errors)==true) {
	$symlink_content = $version;
	$target_symlink = $BUILDS_DIR."/".$latest_symlink_name;

	unlink($target_symlink);
	symlink($symlink_content, $target_symlink);
	echo "Success";
} else {
	print_r($errors);
	return;
}

?>
<html>
   <body>
	  <form action = "" method = "POST" enctype = "multipart/form-data">
		 Key: <input type="text" name="key"><br>
		 Version: <input type="text" name="version"><br>

		 <input type = "submit" name="submit" value="Submit"/>
	  </form>

   </body>
</html>
