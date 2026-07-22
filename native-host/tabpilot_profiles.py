#!/usr/bin/env python3
"""Tab Radar Native Messaging Host - Chrome Profile Manager"""
import sys
import json
import struct
import os
import subprocess
import platform
import base64
import re


def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) == 0:
        sys.exit(0)
    message_length = struct.unpack('<I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)


def send_message(message):
    encoded = json.dumps(message).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def get_local_state_path():
    system = platform.system()
    if system == 'Darwin':
        return os.path.expanduser(
            '~/Library/Application Support/Google/Chrome/Local State'
        )
    elif system == 'Linux':
        return os.path.expanduser('~/.config/google-chrome/Local State')
    elif system == 'Windows':
        return os.path.join(
            os.environ.get('LOCALAPPDATA', ''),
            'Google', 'Chrome', 'User Data', 'Local State'
        )
    return None


def get_chrome_profiles():
    local_state_path = get_local_state_path()
    if not local_state_path or not os.path.exists(local_state_path):
        return {'error': 'Chrome Local State file not found'}

    try:
        with open(local_state_path, 'r') as f:
            local_state = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        return {'error': f'Failed to read Local State: {e}'}

    chrome_dir = os.path.dirname(local_state_path)

    info_cache = local_state.get('profile', {}).get('info_cache', {})
    profiles = []
    for dir_name, info in info_cache.items():
        # Match Chrome's own UI behavior: when the profile still has its
        # default name ("Your Chrome", "Person 1", ...) AND the profile is
        # signed in to a Google account, prefer the gaia_name so users see
        # "Chethan Bhat" rather than "Your Chrome". If the user has set a
        # custom name (is_using_default_name == false), always honor it.
        raw_name = info.get('name', dir_name)
        gaia_name = info.get('gaia_name', '')
        is_default = info.get('is_using_default_name', True)
        display_name = gaia_name if (is_default and gaia_name) else raw_name
        profile = {
            'directory': dir_name,
            'name': display_name,
            'rawName': raw_name,
            'shortcutName': info.get('shortcut_name', ''),
            'gaiaName': gaia_name,
            'userName': info.get('user_name', ''),
            'isUsingDefaultName': is_default,
            'picture': None,
        }
        pic_path = os.path.join(chrome_dir, dir_name, 'Google Profile Picture.png')
        if os.path.exists(pic_path):
            try:
                size = os.path.getsize(pic_path)
                if size < 100_000:
                    with open(pic_path, 'rb') as pf:
                        b64 = base64.b64encode(pf.read()).decode('ascii')
                        profile['picture'] = f'data:image/png;base64,{b64}'
            except Exception:
                pass
        profiles.append(profile)

    profiles.sort(key=lambda p: (p['directory'] != 'Default', p['name'].lower()))
    return {'profiles': profiles}


def get_profile_dirs():
    """Set of real Chrome profile directory names from Local State."""
    local_state_path = get_local_state_path()
    if not local_state_path or not os.path.exists(local_state_path):
        return set()
    try:
        with open(local_state_path, 'r') as f:
            return set(json.load(f).get('profile', {}).get('info_cache', {}).keys())
    except Exception:
        return set()


def switch_profile(profile_directory, open_url=None):
    # Hardening: both values come from the extension message. subprocess uses an
    # argv list (no shell), but a value starting with '-' would be interpreted by
    # Chrome as a launch flag (e.g. --load-extension), and path separators could
    # escape the profile dir. Reject those, and only allow http(s) URLs.
    if (not profile_directory
            or profile_directory.startswith('-')
            or '/' in profile_directory or '\\' in profile_directory
            or not re.match(r'^[A-Za-z0-9 _.+-]+$', profile_directory)):
        return {'error': 'Invalid profile directory'}
    if open_url and not re.match(r'^https?://', open_url):
        return {'error': 'Invalid URL (must be http/https)'}
    system = platform.system()
    try:
        if system == 'Darwin':
            chrome_path = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            args = [chrome_path, f'--profile-directory={profile_directory}']
            if open_url:
                # --new-window forces Chrome to open a new window with the URL
                # even if the profile already has windows open (without this,
                # Chrome ignores the URL argument for existing profiles)
                args.extend(['--new-window', open_url])
            subprocess.Popen(args, start_new_session=True,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif system == 'Linux':
            args = ['google-chrome', f'--profile-directory={profile_directory}']
            if open_url:
                args.append(open_url)
            subprocess.Popen(args, start_new_session=True,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif system == 'Windows':
            chrome_path = os.path.join(
                os.environ.get('PROGRAMFILES', ''),
                'Google', 'Chrome', 'Application', 'chrome.exe'
            )
            args = [chrome_path, f'--profile-directory={profile_directory}']
            if open_url:
                args.append(open_url)
            subprocess.Popen(args, creationflags=0x00000008)
        else:
            return {'error': f'Unsupported platform: {system}'}
        return {'success': True, 'profile': profile_directory}
    except Exception as e:
        return {'error': f'Failed to launch Chrome: {e}'}


def detect_current_profile(extension_id=None):
    """Detect which Chrome profile this extension is running in."""
    local_state_path = get_local_state_path()
    if not local_state_path or not os.path.exists(local_state_path):
        return 'Default'

    chrome_dir = os.path.dirname(local_state_path)

    try:
        with open(local_state_path, 'r') as f:
            local_state = json.load(f)
    except Exception:
        return 'Default'

    info_cache = local_state.get('profile', {}).get('info_cache', {})

    if extension_id:
        matching = []
        for dir_name in info_cache:
            # Method 1: Check Extensions directory (packed extensions)
            ext_dir = os.path.join(chrome_dir, dir_name, 'Extensions', extension_id)
            if os.path.isdir(ext_dir):
                matching.append(dir_name)
                continue
            # Method 2: Check Preferences file (works for unpacked extensions too)
            prefs_path = os.path.join(chrome_dir, dir_name, 'Preferences')
            if os.path.exists(prefs_path):
                try:
                    with open(prefs_path, 'r') as pf:
                        # Match the id as a quoted JSON key, not a loose substring,
                        # to avoid false positives from incidental occurrences.
                        if f'"{extension_id}"' in pf.read():
                            matching.append(dir_name)
                except Exception:
                    pass
        if len(matching) == 1:
            return matching[0]
        # If multiple matches, try process tree below

    # Method 3: Walk process tree for --profile-directory (fast, max 8 levels)
    system = platform.system()
    if system in ('Darwin', 'Linux'):
        try:
            pid = os.getpid()
            for _ in range(8):
                ppid_out = subprocess.check_output(
                    ['ps', '-p', str(pid), '-o', 'ppid='], timeout=1
                ).decode().strip()
                ppid = int(ppid_out)
                if ppid <= 1:
                    break
                args_out = subprocess.check_output(
                    ['ps', '-ww', '-p', str(ppid), '-o', 'args='], timeout=1
                ).decode().strip()
                match = re.search(r'--profile-directory=(\S+)', args_out)
                if match:
                    val = match.group(1).strip('"').strip("'")
                    return val
                pid = ppid
        except Exception:
            pass

        # Method 4: Scan all Chrome processes for --profile-directory
        # and match against profiles that have the extension installed
        if extension_id and matching and len(matching) > 1:
            try:
                ps_out = subprocess.check_output(
                    ['ps', '-eo', 'args='], timeout=2
                ).decode()
                running_profiles = set()
                for line in ps_out.split('\n'):
                    if 'Google Chrome' not in line:
                        continue
                    m = re.search(r'--profile-directory=(\S+)', line)
                    if m:
                        running_profiles.add(m.group(1).strip('"').strip("'"))
                # Intersect running profiles with extension-matched profiles
                overlap = [p for p in matching if p in running_profiles]
                if len(overlap) == 1:
                    return overlap[0]
            except Exception:
                pass

    return 'Default'


def create_new_profile():
    """Create a new Chrome profile by finding the next available directory name."""
    local_state_path = get_local_state_path()
    if not local_state_path or not os.path.exists(local_state_path):
        return {'error': 'Chrome Local State file not found'}

    try:
        with open(local_state_path, 'r') as f:
            local_state = json.load(f)
    except Exception:
        return {'error': 'Failed to read Local State'}

    info_cache = local_state.get('profile', {}).get('info_cache', {})
    existing = set(info_cache.keys())

    n = 1
    while f'Profile {n}' in existing:
        n += 1
    new_dir = f'Profile {n}'

    result = switch_profile(new_dir)
    if result.get('success'):
        result['newProfileDirectory'] = new_dir
    return result


def main():
    message = read_message()
    action = message.get('action')

    if action == 'ping':
        response = {'status': 'ok', 'version': '1.2.0'}
    elif action == 'get-profiles':
        response = get_chrome_profiles()
    elif action == 'switch-profile':
        profile_dir = message.get('profileDirectory')
        open_url = message.get('openUrl')
        if not profile_dir:
            response = {'error': 'Missing profileDirectory'}
        elif profile_dir not in get_profile_dirs():
            # Only switch to a profile that actually exists — prevents launching
            # Chrome with an attacker-supplied directory value.
            response = {'error': 'Unknown profile directory'}
        else:
            response = switch_profile(profile_dir, open_url)
    elif action == 'detect-profile':
        ext_id = message.get('extensionId')
        profile_dir = detect_current_profile(ext_id)
        response = {'profileDirectory': profile_dir}
    elif action == 'create-profile':
        response = create_new_profile()
    else:
        response = {'error': f'Unknown action: {action}'}

    send_message(response)


if __name__ == '__main__':
    main()
