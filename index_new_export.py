with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

OLD = '''        <div class="export-card google-card" onclick="openGoogleSheetsSetup()">
          <div class="export-icon">🔗</div>
          <div class="export-info">
            <div class="export-title">Sincronizare Google Sheets</div>
            <div class="export-sub" id="gsheets-status-text">Neconfigurat — apasă pentru configurare</div>
          </div>
          <div class="export-arrow" id="gsheets-status-icon">→</div>
        </div>
      </div>

      <!-- Google Sheets config panel -->
      <div id="gsheets-config" class="gsheets-config hidden">
        <h3 class="subsection-title">Configurare Google Sheets</h3>
        <div class="info-box">
          <strong>Pași necesari:</strong>
          <ol class="setup-steps">
            <li>Mergi la <a href="https://console.cloud.google.com" target="_blank" class="link">Google Cloud Console</a></li>
            <li>Creează un proiect nou → activează <em>Google Sheets API</em> și <em>Google Drive API</em></li>
            <li>Creează credențiale <strong>OAuth 2.0</strong> (tip: Web application)</li>
            <li>Adaugă <code class="code-inline" id="origin-display"></code> la Authorized JavaScript origins</li>
            <li>Copiază <strong>Client ID</strong> mai jos</li>
          </ol>
        </div>
        <div class="input-group">
          <label class="input-label">Google Client ID</label>
          <input type="text" id="google-client-id" class="text-input" placeholder="xxxx.apps.googleusercontent.com" />
        </div>
        <button class="btn-primary" onclick="saveGoogleConfig()">Salvează și conectează</button>
        <div id="google-auth-section" class="hidden" style="margin-top:1rem;">
          <button class="btn-google" onclick="signInGoogle()">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" alt="" style="vertical-align:middle;margin-right:8px;">
            Autentifică cu Google
          </button>
          <div id="google-user-info" class="google-user-info hidden"></div>
        </div>
      </div>'''

NEW = '''        <div class="export-card google-card" onclick="openGoogleSheetsSetup()">
          <div class="export-icon">🔗</div>
          <div class="export-info">
            <div class="export-title">Sincronizare Google Sheets</div>
            <div class="export-sub" id="gsheets-status-text">Neconfigurat — apasă pentru configurare</div>
          </div>
          <div class="sync-status-dot" id="sync-status-dot"></div>
        </div>
      </div>

      <!-- Sync status bar -->
      <div id="sync-status-bar" class="sync-status-bar hidden">
        <div class="sync-bar-left">
          <span class="sync-bar-dot" id="sync-bar-dot"></span>
          <span id="sync-bar-text">Neconfigurat</span>
        </div>
        <button class="sync-manual-btn" id="sync-manual-btn" onclick="syncAllPending()" style="display:none">
          ↑ Sincronizează acum
        </button>
      </div>

      <!-- Google Sheets config panel -->
      <div id="gsheets-config" class="gsheets-config hidden">
        <h3 class="subsection-title">Configurare Google Sheets (Apps Script)</h3>
        <div class="info-box">
          <strong>Pași necesari (o singură dată):</strong>
          <ol class="setup-steps">
            <li>Deschide <a href="https://sheets.google.com" target="_blank" class="link">Google Sheets</a> → creează un fișier nou (ex: <em>Archery Scorer Data</em>)</li>
            <li>Click <strong>Extensions → Apps Script</strong></li>
            <li>Șterge tot și lipește codul din fișierul <code class="code-inline">appsscript.gs</code> (din zip)</li>
            <li>Click <strong>Deploy → New deployment → Web App</strong></li>
            <li>Execute as: <strong>Me</strong> · Who has access: <strong>Anyone</strong> → Deploy</li>
            <li>Copiază <strong>Web App URL</strong> mai jos</li>
          </ol>
        </div>
        <div class="input-group">
          <label class="input-label">Web App URL</label>
          <input type="text" id="google-script-url" class="text-input" placeholder="https://script.google.com/macros/s/..." />
        </div>
        <button class="btn-primary" onclick="saveScriptUrl()">💾 Salvează și testează conexiunea</button>
        <div id="script-test-result" class="hidden" style="margin-top:.75rem;font-size:.82rem;padding:.5rem .75rem;border-radius:6px;"></div>
      </div>'''

assert OLD in html, "OLD block not found!"
html = html.replace(OLD, NEW, 1)
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Done")
