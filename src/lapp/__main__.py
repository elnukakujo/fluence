import argparse
import atexit
import os
import signal
import tempfile
from .api.app import create_app

PID_FILE = os.path.join(tempfile.gettempdir(), "lapp_server.pid")


def _kill_stale_instance():
    """Kill any previous server instance left running from an earlier start."""
    if not os.path.exists(PID_FILE):
        return
    try:
        old_pid = int(open(PID_FILE).read().strip())
        os.kill(old_pid, signal.SIGTERM)
        print(f"🧹 Killed stale server instance (pid {old_pid})")
    except (ValueError, ProcessLookupError, PermissionError):
        pass


def _register_pid_file():
    with open(PID_FILE, "w") as f:
        f.write(str(os.getpid()))
    atexit.register(lambda: os.path.exists(PID_FILE) and os.remove(PID_FILE))


def _force_exit_on_signal(signum, frame):
    """A stuck background job (e.g. a hung model.generate() call) runs on a
    non-daemon thread pool thread, which Python's normal shutdown would wait
    on forever. os._exit bypasses atexit/thread-join entirely so Ctrl+C
    actually kills the process instead of hanging."""
    if os.path.exists(PID_FILE):
        os.remove(PID_FILE)
    print(f"\n🛑 Received signal {signum}, force-exiting immediately")
    os._exit(0)


def parse_args():
    """Parse command line arguments. Each flag falls back to an env var, then a default."""
    parser = argparse.ArgumentParser(description='Run the Flask application')
    parser.add_argument(
        '--env',
        choices=['dev', 'test', 'prod'],
        default=os.environ.get('LAPP_ENV', 'dev'),
        help='Environment to run in (default: dev, env: LAPP_ENV)'
    )
    parser.add_argument(
        '--host',
        default=os.environ.get('LAPP_HOST', '127.0.0.1'),
        help='Host to run on (default: 127.0.0.1, env: LAPP_HOST)'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=int(os.environ.get('LAPP_PORT', 5000)),
        help='Port to run on (default: 5000, env: LAPP_PORT)'
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        default=os.environ.get('LAPP_DEBUG', '').lower() in ('1', 'true', 'yes'),
        help='Enable debug mode (overrides environment setting, env: LAPP_DEBUG)'
    )
    return parser.parse_args()


def main():
    args = parse_args()

    # In debug mode, Werkzeug's reloader re-runs main() in a child process
    # (marked via WERKZEUG_RUN_MAIN) that does the actual serving, while the
    # parent just watches for file changes. Only the top-level launch should
    # kill a leftover instance and claim the PID file - otherwise the
    # reloader's own child mistakes its just-started parent for a stale
    # instance and kills it, tearing down the whole process tree.
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        _kill_stale_instance()
        _register_pid_file()
    signal.signal(signal.SIGINT, _force_exit_on_signal)
    signal.signal(signal.SIGTERM, _force_exit_on_signal)

    # Create app with specified environment
    app = create_app(config_name=args.env)
    
    # Override debug if specified
    if args.debug:
        app.config['DEBUG'] = True
    
    print(f"🚀 Starting Flask server in {args.env} mode")
    print(f"📍 Running on http://{args.host}:{args.port}")
    
    # Run the app
    app.run(
        host=args.host,
        port=args.port,
        debug=app.config.get('DEBUG', False),
        threaded=True,
    )

if __name__ == '__main__':
    main()