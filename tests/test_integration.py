"""
Test integration and configuration
"""
import os
import sys


class TestPackageImports:
    """Test that all critical modules can be imported"""

    def test_import_chatgpt(self):
        """Test ChatGPT module import"""
        from textgenhub import chatgpt

        assert chatgpt is not None
        assert hasattr(chatgpt, "ask")

    def test_import_deepseek(self):
        """Test DeepSeek module import"""
        from textgenhub import deepseek

        assert deepseek is not None

    def test_import_perplexity(self):
        """Test Perplexity module import"""
        from textgenhub import perplexity

        assert perplexity is not None

    def test_import_grok(self):
        """Test Grok module import"""
        from textgenhub import grok

        assert grok is not None

    def test_import_cli(self):
        """Test CLI module import"""
        from textgenhub.cli import run_provider_old, main

        assert callable(run_provider_old)
        assert callable(main)

    def test_import_provider(self):
        """Test core provider import"""
        from textgenhub.core.provider import SimpleProvider

        assert SimpleProvider is not None

    def test_import_utils(self):
        """Test utilities import"""
        from textgenhub.utils import browser_utils
        from textgenhub.utils.chatgpt_tab_manager import ChatGPTTabManager

        assert browser_utils is not None
        assert ChatGPTTabManager is not None


class TestFileSystemStructure:
    """Test project structure integrity"""

    def test_logs_directory_exists(self):
        """Test logs directory for artifacts"""
        logs_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
        assert os.path.exists(logs_path), "logs/ directory must exist"
        assert os.path.isdir(logs_path), "logs/ must be a directory"

    def test_src_structure(self):
        """Test src directory structure"""
        src_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "textgenhub")
        assert os.path.isdir(src_path)
        assert os.path.isdir(os.path.join(src_path, "chatgpt"))
        assert os.path.isdir(os.path.join(src_path, "chatgpt_old"))
        assert os.path.isdir(os.path.join(src_path, "core"))
        assert os.path.isdir(os.path.join(src_path, "utils"))

    def test_no_artifacts_in_root(self):
        """Test artifacts directory not in root"""
        root_path = os.path.dirname(os.path.dirname(__file__))
        artifacts_path = os.path.join(root_path, "artifacts")
        assert not os.path.exists(artifacts_path), "artifacts/ should not exist in root"

    def test_no_temp_in_root(self):
        """Test temp directory not in root"""
        root_path = os.path.dirname(os.path.dirname(__file__))
        temp_path = os.path.join(root_path, "temp")
        assert not os.path.exists(temp_path), "temp/ should not exist in root"


class TestConfigurationFiles:
    """Test configuration file existence and format"""

    def test_pytest_ini_exists(self):
        """Test pytest.ini exists"""
        pytest_ini = os.path.join(os.path.dirname(os.path.dirname(__file__)), "pytest.ini")
        assert os.path.exists(pytest_ini)

    def test_pre_commit_config_exists(self):
        """Test .pre-commit-config.yaml exists"""
        config = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".pre-commit-config.yaml")
        assert os.path.exists(config)

    def test_pyproject_toml_exists(self):
        """Test pyproject.toml exists"""
        pyproject = os.path.join(os.path.dirname(os.path.dirname(__file__)), "pyproject.toml")
        assert os.path.exists(pyproject)

    def test_package_json_exists(self):
        """Test package.json exists in root"""
        package_json = os.path.join(os.path.dirname(os.path.dirname(__file__)), "package.json")
        assert os.path.exists(package_json)

    def test_src_package_json_exists(self):
        """Test package.json exists in src/textgenhub"""
        package_json = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "textgenhub", "package.json")
        assert os.path.exists(package_json)


class TestIndexJsExports:
    """Test index.js exports"""

    def test_index_js_exports(self):
        """Test that index.js exports correct modules"""
        index_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "index.js")
        with open(index_path, "r") as f:
            content = f.read()

        # Check exports
        assert "ChatGPT" in content
        assert "ChatGPTLegacy" in content or "chatgpt_old" in content.lower()
        assert "DeepSeek" in content
        assert "Perplexity" in content
        assert "Grok" in content
        assert "module.exports" in content


class TestREADMEDocumentation:
    """Test README contains critical information"""

    def test_readme_exists(self):
        """Test README.md exists"""
        readme = os.path.join(os.path.dirname(os.path.dirname(__file__)), "README.md")
        assert os.path.exists(readme)

    def test_readme_contains_chatgpt_info(self):
        """Test README documents ChatGPT providers"""
        readme = os.path.join(os.path.dirname(os.path.dirname(__file__)), "README.md")
        with open(readme, "r") as f:
            content = f.read()

        assert "ChatGPT" in content
        assert "--old" in content or "legacy" in content.lower()
        assert "attach" in content.lower()

    def test_readme_contains_cli_examples(self):
        """Test README has CLI examples"""
        readme = os.path.join(os.path.dirname(os.path.dirname(__file__)), "README.md")
        with open(readme, "r") as f:
            content = f.read()

        assert "poetry run textgenhub" in content
        assert "deepseek" in content.lower()
        assert "perplexity" in content.lower()


class TestPythonVersion:
    """Test Python environment"""

    def test_python_version(self):
        """Test Python 3.11+"""
        assert sys.version_info >= (3, 11), "Python 3.11+ required"

    def test_python_executable(self):
        """Test Python executable exists"""
        assert sys.executable is not None
        assert os.path.exists(sys.executable)
