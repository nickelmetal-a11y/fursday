with open('src/App.js', 'r', encoding='utf8') as f:
    content = f.read()

old_end = "isSitter ? 'Open' : 'Join'}</span>\n          </div>\n        </div>"
idx = content.find(old_end)
if idx == -1:
    print('ERROR: banner end not found')
else:
    start = content.rfind('\n        <div onClick', 0, idx)
    end = idx + len(old_end)

    new_banner = """
        {isSitter ? (
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <div onClick={() => setIsSitterMode(true)}
              style={{ flex: 2, background: '#1a1a2e', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💰</div>
              <div>
                <div style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>Sitter Dashboard</div>
                <div style={{ color: '#4CAF50', fontSize: 11, fontWeight: 600 }}>● You are live</div>
              </div>
            </div>
            <div onClick={() => setShowSitterEdit(true)}
              style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)' }}>
              <span style={{ fontSize: 18 }}>✏️</span>
              <span style={{ color: 'white', fontSize: 11, marginTop: 4 }}>Edit</span>
            </div>
          </div>
        ) : (
          <div onClick={() => setShowOnboarding(true)}
            style={{ marginTop: 12, background: '#1a1a2e', borderRadius: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🐾</div>
              <div>
                <div style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>Become a Fursday sitter</div>
                <div style={{ color: theme.primary, fontSize: 11, fontWeight: 600, marginTop: 1 }}>Earn Rs.12,000-45,000/month</div>
              </div>
            </div>
            <div style={{ background: theme.primary, borderRadius: 10, padding: '7px 14px' }}>
              <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>Join</span>
            </div>
          </div>
        )}"""

    content = content[:start] + new_banner + content[end:]
    with open('src/App.js', 'w', encoding='utf8') as f:
        f.write(content)
    print('Done: banner replaced')
