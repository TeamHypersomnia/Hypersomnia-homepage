alias rsync_git="rsync --exclude='/.git' --filter='dir-merge,- .gitignore'"
. ./ADDRESS
TARGET_FOLDER=page

rsync_git -avzP . $ADDRESS:/var/www/html --delete-after
