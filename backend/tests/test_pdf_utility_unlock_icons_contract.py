"""PDF utility icon rendering and password-unlock expectations."""
from pathlib import Path
import subprocess
import fitz

ROOT=Path(__file__).resolve().parents[2]


def read(path):
    return (ROOT/path).read_text(encoding='utf-8')


def test_pdf_utility_no_plain_english_menu_icons():
    shell=read('js/pdf-suite/single-page-shell.js')
    clean=read('js/pdf-suite/clean-ui.js')
    source=read('pdf-suite/index.html')
    assert 'const ICON_SHAPES=Object.freeze({' in shell
    assert 'window.ProgramStudioPdfUtilityIcons=Object.freeze({markup:iconMarkup})' in shell
    assert '${iconMarkup(tool.icon)}' in shell
    assert 'const symbol=window.ProgramStudioPdfUtilityIcons?.markup?.(item.icon)||item.icon;' in clean
    assert '.pdfuc-category .pdfu-menu-icon svg{' in clean
    assert 'tool-icon">IMG' in source
    output=subprocess.run(['node','backend/tests/pdf_utility_icons_behavior.cjs'],
                          cwd=ROOT,text=True,capture_output=True,check=False)
    assert output.returncode==0,output.stdout+output.stderr
    assert 'pdf utility vector icons behavior passed' in output.stdout


def test_unlock_requires_correct_nonempty_password_when_user_password_exists():
    document=fitz.open()
    document.new_page().insert_text((50,70),'Password test')
    data=document.tobytes(encryption=fitz.PDF_ENCRYPT_AES_256,
                          owner_pw='private-owner-2026',user_pw='user-access-2026')
    document.close()
    secured=fitz.open(stream=data,filetype='pdf')
    try:
        assert secured.is_encrypted
        assert not secured.authenticate('')
        assert not secured.authenticate('wrong-password')
        assert secured.authenticate('user-access-2026')
    finally:
        secured.close()


def test_empty_password_auth_only_when_encryption_allows_it():
    document=fitz.open()
    document.new_page().insert_text((50,70),'Owner restrictions test')
    data=document.tobytes(encryption=fitz.PDF_ENCRYPT_AES_256,
                          owner_pw='owner-access-2026',user_pw='')
    document.close()
    secured=fitz.open(stream=data,filetype='pdf')
    try:
        assert secured.authenticate('')
    finally:
        secured.close()


def test_server_and_user_help_never_claim_password_recovery():
    route=read('backend/routers/pdf_tools.py')
    large=read('backend/routers/pdf_large_security.py')
    direct=read('js/pdf-suite/direct-tool-bridge.js')
    preflight=read('pdf-preflight/index.html')
    manual=read('js/program-manuals/pdf-suite.js')
    assert 'source.is_encrypted and not source.authenticate(password)' in route
    assert '"PASSWORD_INVALID"' in route
    assert 'document.is_encrypted and not document.authenticate(password)' in large
    assert 'PDF_ENCRYPT_NONE' in route
    assert '비밀번호를 모르는 암호화 PDF는 이 기능으로 해독할 수 없습니다.' in direct
    assert '빈 비밀번호로 인증할 수 있는 PDF인지 확인합니다.' in preflight
    assert '잊어버린 비밀번호를 찾아주지 않습니다.' in preflight
    assert '일반적인 열기 비밀번호를 모르면' in manual
