"""Drive WebKitGTK (WebKit2 4.1) on the built docs site and run an async JS function in the page.

Usage: xvfb-run -a python3 -I dev/tools/webkitgtk-probe.py --site DIR --hash '#/en/components/DataTable' --js FILE
         [--mode light] [--density compact] [--width 1280] [--height 800]
         [--focus] [--snapshot out.png] [--arg JSON]
The JS file holds an async arrow function `async (arg) => {...}`; its JSON result is printed on stdout.
A static server for DIR runs in a thread of this process (only needs loopback).
"""
import argparse
import functools
import json
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import gi

gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import GLib, Gtk, WebKit2  # noqa: E402

p = argparse.ArgumentParser()
p.add_argument('--site', required=True)
p.add_argument('--hash', required=True)
p.add_argument('--js', required=True)
p.add_argument('--mode', default='light')
p.add_argument('--density', default='comfortable')
p.add_argument('--width', type=int, default=1280)
p.add_argument('--height', type=int, default=800)
p.add_argument('--focus', action='store_true')
p.add_argument('--offscreen', action='store_true')
p.add_argument('--snapshot')
p.add_argument('--arg', default='null')
p.add_argument('--timeout', type=int, default=90)
a = p.parse_args()


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


Quiet.extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript',
                        '.mjs': 'text/javascript', '.woff2': 'font/woff2'}
server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=a.site))
threading.Thread(target=server.serve_forever, daemon=True).start()
port = server.server_address[1]

with open(a.js) as f:
    fn_src = f.read()

ucm = WebKit2.UserContentManager()
init = f"""
try {{
  localStorage.setItem('vellum-ui-docs:color-mode', {json.dumps(a.mode)});
  localStorage.setItem('vellum-ui-docs:density', {json.dumps(a.density)});
  localStorage.setItem('vellum-ui-docs:lang', 'en');
}} catch (e) {{}}
"""
ucm.add_script(WebKit2.UserScript.new(init, WebKit2.UserContentInjectedFrames.TOP_FRAME,
                                      WebKit2.UserScriptInjectionTime.START, None, None))
view = WebKit2.WebView.new_with_user_content_manager(ucm)
settings = view.get_settings()
settings.set_enable_developer_extras(True)
win = Gtk.OffscreenWindow() if a.offscreen else Gtk.Window()
win.set_default_size(a.width, a.height)
win.add(view)
win.show_all()

state = {'done': False, 'code': 0}


def finish(code=0):
    if state['done']:
        return
    state['done'] = True
    state['code'] = code
    server.shutdown()
    Gtk.main_quit()


def on_snapshot(v, res):
    try:
        surface = v.get_snapshot_finish(res)
        surface.write_to_png(a.snapshot)
    except Exception as e:  # noqa: BLE001
        print(json.dumps({'snapshotError': str(e)}), file=sys.stderr)
    finish(0)


def on_js(v, res):
    try:
        value = v.call_async_javascript_function_finish(res)
        print(value.to_string())
    except Exception as e:  # noqa: BLE001
        print(json.dumps({'jsError': str(e)}))
        finish(1)
        return
    if a.snapshot:
        v.get_snapshot(WebKit2.SnapshotRegion.VISIBLE, WebKit2.SnapshotOptions.NONE, None, on_snapshot)
    else:
        finish(0)


def run_js():
    if a.focus:
        if not a.offscreen:
            win.present()
        view.grab_focus()
    meta = {
        'webkit': f'{WebKit2.get_major_version()}.{WebKit2.get_minor_version()}.{WebKit2.get_micro_version()}',
        'accel': settings.get_hardware_acceleration_policy().value_nick,
        'winActive': win.is_active(),
        'viewHasFocus': view.has_focus(),
    }
    body = f"const __meta = {json.dumps(meta)};\nconst __r = await ({fn_src})({a.arg});\n" \
           "return JSON.stringify({meta: __meta, result: __r});"
    view.call_async_javascript_function(body, -1, None, None, None, None, on_js)
    return False


def on_load(v, event):
    if event == WebKit2.LoadEvent.FINISHED:
        GLib.timeout_add(300, run_js)


view.connect('load-changed', on_load)
GLib.timeout_add_seconds(a.timeout, lambda: (print(json.dumps({'error': 'timeout'})), finish(2)))
view.load_uri(f'http://127.0.0.1:{port}/index.html{a.hash}')
Gtk.main()
sys.exit(state['code'])
