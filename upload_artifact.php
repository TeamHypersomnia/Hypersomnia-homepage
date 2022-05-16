<?php

if(isset($_FILES['artifact'])){
	$errors= array();
	$file_name = $_FILES['artifact']['name'];
	$file_tmp = $_FILES['artifact']['tmp_name'];
	$sig_file_name = $_FILES['signature']['name'];
	$sig_file_tmp = $_FILES['signature']['tmp_name'];

	require_once __DIR__.'/vendor/autoload.php';

	$dotenv = Dotenv\Dotenv::createImmutable(__DIR__.'/../');
	$dotenv->load();

	$version = $_POST["version"];
	$artifact_type = $_POST["artifact_type"];
	$platform = $_POST["platform"];
	$BUILDS_DIR = "builds";
	$target_folder = $BUILDS_DIR."/".$version;
	$target_artifact_path = $target_folder."/".$file_name;
	$target_signature_path = $target_folder."/".$sig_file_name;

	if (!isset($_POST["version"])) {
		$errors[]="Version is not set!";
	}

	if (!isset($_POST["platform"])) {
		$errors[]="Platform is not set!";
	}

	if (!isset($_POST["artifact_type"])) {
		$errors[]="Artifact type is not set!";
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

		#echo "move_uploaded_file(".$file_tmp.", ".$target_artifact_path.")";

		if ($move_result == false) {
			echo "Failed to move the artifact: ".$target_artifact_path."\n";
		}
		else {
			echo "Successfully moved the artifact: ".$target_artifact_path."\n";
		}

		$move_result = move_uploaded_file($sig_file_tmp, $target_signature_path);

		if ($move_result == false) {
			echo "Failed to move the artifact signature: ".$target_signature_path."\n";
		}
		else {
			echo "Successfully moved the artifact signature: ".$target_signature_path."\n";
		}
	} else {
		print_r($errors);
		return;
	}

	if ($artifact_type == "updater") {
		// Only signal the newest version if we're uploading an updater archive.

		$version_file_name = "version-".$platform.".txt";
		$version_file_path = $target_folder."/".$version_file_name;

		$signature = file_get_contents($target_signature_path);
		$version_file_contents = $version."\nUpdate archive signature:\n".$signature;

		file_put_contents($version_file_path, $version_file_contents);

		$last_uploaded_version_path = $BUILDS_DIR."/last_uploaded_version.txt";
		$last_uploaded_version_contents = $version;

		file_put_contents($last_uploaded_version_path, $last_uploaded_version_contents);
	}
}
?>
<html>
   <body>

	  <form action = "" method = "POST" enctype = "multipart/form-data">
		 <input type = "file" name = "artifact" /> <br>
		 <input type = "file" name = "signature" /> <br>
		 Key: <input type="text" name="key"><br>
		 Version: <input type="text" name="version"><br>
		 Platform: <input type="text" name="platform"><br>
		 Artifact type: <input type="text" name="artifact_type"><br>

		 <input type = "submit" name="submit" value="Submit"/>
	  </form>

   </body>
</html>
