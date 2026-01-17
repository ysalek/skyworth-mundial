import os
import time
from playwright.sync_api import sync_playwright

def verify_landing():
    # Ensure verification directory exists
    if not os.path.exists('verification'):
        os.makedirs('verification')

    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        try:
            # We assume the build output is static and we can serve it or just open the html if it was simple.
            # But this is a React app, so opening index.html directly might fail due to routing/module scripts if not served.
            # However, we built it to 'dist/'. Let's try to start a simple python server in background or use preview.

            # Actually, the environment might not support background processes well if we can't kill them easily.
            # But let's try to use 'npm run preview' in background.

            print("Starting server...")
            # We can't easily start a server here in python without blocking or complex subprocess.
            # Instead, we will assume the user has started it or we rely on 'npm run preview' in a separate bash tool call?
            # No, we have to do it all here or in bash.

            # Since I cannot run background processes easily in a single tool call sequence (I can, but I need to manage them),
            # I will assume I can serve the 'dist' folder.

            # Let's try to just use 'http.server' in a subprocess if possible, or assume port 4173 (default vite preview).
            import subprocess

            # Start preview server
            process = subprocess.Popen(["npm", "run", "preview", "--", "--port", "4173", "--strictPort"],
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE)

            # Wait for server to start
            time.sleep(5)

            print("Navigating to landing page...")
            page.goto("http://localhost:4173")

            # Wait for Hero content
            page.wait_for_selector("text=EL SUEÑO")

            # 1. Take screenshot of Top (Hero + Prize)
            page.screenshot(path="verification/landing_top.png")
            print("Screenshot landing_top.png taken")

            # 2. Scroll to Form
            register_btn = page.get_by_role("button", name="REGISTRAR COMPRA")
            if register_btn.is_visible():
                register_btn.click()
                time.sleep(1) # wait for scroll
                page.screenshot(path="verification/landing_form.png")
                print("Screenshot landing_form.png taken")
            else:
                print("Register button not found")

            # 3. Test Validation UI (Mocking input)
            # Find Serial Input
            serial_input = page.get_by_placeholder("INGRESA EL SERIAL")
            if serial_input.is_visible():
                serial_input.fill("TEST12345")
                serial_input.blur()
                time.sleep(2) # Wait for validation (it will fail/mock network error since backend isn't real here, but UI should show state)
                page.screenshot(path="verification/landing_validation.png")
                print("Screenshot landing_validation.png taken")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            # Cleanup
            if 'process' in locals():
                process.kill()
            browser.close()

if __name__ == "__main__":
    verify_landing()
