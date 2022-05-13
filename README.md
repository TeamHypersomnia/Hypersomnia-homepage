# Hypersomnia downloads page

Currently hosted at https://hypersomnia.xyz/

### ``upload_artifact.php`` 

Upload the newest game build for a given platform. The CI servers - e.g. AppVeyor, GitHub actions, Travis CI - use this API after every ``git push``. The new game binaries appear inside the ``builds/`` folder: https://hypersomnia.xyz/builds/


### ``set_latest_version.php`` 

This API lets the server admin manually set the game version to which the game's clients will update on their next launch.
