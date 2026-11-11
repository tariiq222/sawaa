from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


class CocoaPodsCorePreparationTest(unittest.TestCase):
    def test_rejects_unverified_archive_before_installing_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            prepare = root / "prepare-cocoapods-core.rb"
            shutil.copyfile(Path(__file__).with_name(prepare.name), prepare)
            archive = root / "cocoapods-core-1.17.0.gem"
            archive.write_bytes(b"not the locked upstream archive")
            result = subprocess.run(
                ["ruby", str(prepare), str(archive)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("archive checksum", result.stderr)
            self.assertFalse((root / "vendor" / "cocoapods-core").exists())


if __name__ == "__main__":
    unittest.main()
