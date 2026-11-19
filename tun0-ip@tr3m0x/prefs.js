import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {addThemePage} from './themePrefs.js';

export default class TunIpPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        addThemePage(window, this);
    }
}
