import smtplib
from email.mime.text import MIMEText

# Configuration
smtp_server = "smtp.gmail.com"
smtp_port = 587
email = "touyoo3474@gmail.com"
password = "kpnmdavgjizipysh"  # mot de passe d'application, pas ton mot de passe Gmail

# Création du message
msg = MIMEText("Bonjour, ceci est un test SMTP via Gmail.")
msg["Subject"] = "Test SMTP"
msg["From"] = email
msg["To"] = "touyoo3474@gmail.com"

# Envoi
with smtplib.SMTP(smtp_server, smtp_port) as server:
    server.starttls()  # Sécurise la connexion
    server.login(email, password)
    server.send_message(msg)

print("E-mail envoyé avec succès ✅")