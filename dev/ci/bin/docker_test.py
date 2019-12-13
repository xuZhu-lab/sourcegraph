import os.path

# Hack to load "docker" script since pytest can't discover it since it isn't a
# legit python script.
def load_source(name, path):
    import importlib.machinery
    import importlib.util

    loader = importlib.machinery.SourceFileLoader(name, path)
    spec = importlib.util.spec_from_loader(loader.name, loader)
    mod = importlib.util.module_from_spec(spec)
    loader.exec_module(mod)
    return mod


docker = load_source("docker_wrapper", os.path.dirname(__file__) + "/docker")


def test_get_memory_cgroup():
    data = """12:net_cls,net_prio:/kubepods/burstable/pod828291bc-1962-11ea-bc13-42010a800046/3b6bb8b8c5848a5894dfea613736249bcdd85a51421e36d3ce46bd7a140376ab
5:memory:/kubepods/burstable/pod828291bc-1962-11ea-bc13-42010a800046/3b6bb8b8c5848a5894dfea613736249bcdd85a51421e36d3ce46bd7a140376ab
"""
    assert (
        docker.get_memory_cgroup(data)
        == "/kubepods/burstable/pod828291bc-1962-11ea-bc13-42010a800046/3b6bb8b8c5848a5894dfea613736249bcdd85a51421e36d3ce46bd7a140376ab"
    )


def test_docker_env():
    env = {"PATH": "/builds/dev/ci/bin:/usr/bin"}
    assert docker.docker_env(env, script_path="/builds/dev/ci/bin/docker") == {
        "PATH": "/usr/bin"
    }


def test_docker_add_cgroup_parent():
    import shlex

    cases = {
        "run foo": "run --cgroup-parent cgroup_test foo",
        "-D run --rm foo": "-D run --cgroup-parent cgroup_test --rm foo",
        "rm foo": "rm foo",
        "build": "build --cgroup-parent cgroup_test",
    }
    for argv, want in cases.items():
        argv = shlex.split(argv)
        want = shlex.split(want)
        got = docker.docker_add_cgroup_parent(argv, "cgroup_test")
        assert got == want
