# Running Oil Imperium in a Proxmox LXC container

These steps put the game server in a small Debian container on your Proxmox host.

## 1. Create the container

In the Proxmox web UI: **Create CT**.

- Template: Debian 12 (download it under *local > CT Templates > Templates* if missing)
- Unprivileged: yes
- Disk: 4 GB
- CPU: 1 core
- Memory: 512 MB, swap 256 MB
- Network: DHCP is fine, or give it a fixed IP so you can find it later

Start the container and open its **Console**, logged in as root.

## 2. Install Node.js 22 and git

```sh
apt update && apt install -y curl git ca-certificates
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v   # should print v22.x
```

## 3. Get the game and build it

```sh
git clone https://github.com/cfj6dfptjb-eng/oil-imperium /opt/oil-imperium
useradd --system --home-dir /opt/oil-imperium oil
cd /opt/oil-imperium
npm ci
npm run build
chown -R oil:oil /opt/oil-imperium
```

If the repository is private, git will ask you to sign in. Use a GitHub
[personal access token](https://github.com/settings/tokens) as the password.

## 4. Run it as a service

```sh
cp deploy/oil-imperium.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now oil-imperium
systemctl status oil-imperium
```

Open `http://<container-ip>:3000` from a computer on your home network. The
bottom line of the title screen should say **SERVER ONLINE**.

## 5. Updating

```sh
cd /opt/oil-imperium
sudo -u oil git pull
sudo -u oil npm ci
sudo -u oil npm run build
systemctl restart oil-imperium
```

## 6. Letting friends connect over the internet

The easiest options need no router changes and give you HTTPS for free:

- **Cloudflare Tunnel**: requires a domain on Cloudflare. Install `cloudflared` in the
  container and point a tunnel at `http://localhost:3000`.
- **Tailscale Funnel**: install Tailscale in the container and run
  `tailscale funnel 3000`. LXC containers need `/dev/net/tun` passed through for this.

Both support WebSockets, which the game needs. Details will come in the
self-hosting milestone.

## Alternative: Docker

If you prefer Docker (for example inside a VM or a privileged LXC with nesting enabled):

```sh
docker build -t oil-imperium .
docker run -d --name oil-imperium -p 3000:3000 --restart unless-stopped oil-imperium
```
