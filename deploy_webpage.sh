. ./ADDRESS
TARGET_FOLDER=page

rsync --exclude='builds' --exclude='/.git' -avzP . $ADDRESS:/var/www/html --delete-after
