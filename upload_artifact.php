<?php

if(isset($_FILES['artifact'])){
	$errors= array();
	$file_name = $_FILES['artifact']['name'];
	$file_tmp = $_FILES['artifact']['tmp_name'];

	require_once __DIR__.'/vendor/autoload.php';

	$dotenv = Dotenv\Dotenv::createImmutable(__DIR__.'/../');
	$dotenv->load();

	$version = $_POST["version"];
	$signature = $_POST["signature"];
	$is_updater = $_POST["is_updater"];
	$platform = $_POST["platform"];
	$commit_message  = $_POST["commit_message"];
	$BUILDS_DIR = "builds";
	$target_folder = $BUILDS_DIR."/".$version;
	$target_artifact_path = $target_folder."/".$file_name;
	$signature_file_name = $file_name.".signature.txt";
	$signature_file_path = $target_folder."/".$signature_file_name;

	if (strstr($commit_message, "[TEST]")) {
		$staging_folder_name = "test";
	}

	if (!isset($_POST["version"])) {
		$errors[]="Version is not set!";
	}

	if ($_POST["version"] == "_") {
		$errors[]="Version is set to _!";
	}

	if ($_ENV["ARTIFACT_UPLOAD_KEY"] != $_POST["key"]) {
		$errors[]="Key does not match!\nSent key:".$_POST["key"];
	}

	if (empty($errors)==true) {
		$nowcwd = getcwd();
		mkdir($target_folder, 0777, true);
		$move_result = move_uploaded_file($file_tmp, $target_artifact_path);
		chmod($target_artifact_path, 0755);

		echo "move_uploaded_file(".$file_tmp.", ".$target_artifact_path.")";

		if ($move_result == false) {
			echo "Returned false. ";
		}
		else {
			echo "Success.";
		}
	} else {
		print_r($errors);
		return;
	}

	if ($is_updater == "true") {
		// Only signal the newest version if we're uploading an updater archive.

		$version_file_name = "version-".$platform.".txt";
		$version_file_path = $target_folder."/".$version_file_name;
		$version_file_contents = $version."\nUpdate archive signature:\n".$signature;

		file_put_contents($version_file_path, $version_file_contents);

		$last_uploaded_version_path = $BUILDS_DIR."/last_uploaded_version.txt";
		$last_uploaded_version_contents = $version;

		file_put_contents($last_uploaded_version_path, $last_uploaded_version_contents);
	}


	file_put_contents($signature_file_path, $signature);
}
?>
<html>
   <body>

	  <form action = "" method = "POST" enctype = "multipart/form-data">
		 <input type = "file" name = "artifact" /> <br>
		 Key: <input type="text" name="key"><br>
		 Version: <input type="text" name="version"><br>
		 Platform: <input type="text" name="platform"><br>
		 Commit message: <input type="text" name="commit_message"><br>

		 <input type = "submit" name="submit" value="Submit"/>
	  </form>

   </body>
</html>
