(() => {
  'use strict';
  const menuButton = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (menuButton && navLinks) {
    menuButton.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(open));
    });
    navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
    }));
  }
  document.querySelectorAll('[data-open-dialog]').forEach(button => {
    button.addEventListener('click', () => {
      const dialog = document.getElementById(button.dataset.openDialog);
      dialog?.showModal();
    });
  });
  document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
  });
  const details = {
    infrastructure: {
      title: 'Infrastructure with Terraform', icon: '⬡',
      text: 'Terraform creates a new VPC, networking across two AWS Availability Zones, an Application Load Balancer, an EC2 Launch Template and an Auto Scaling Group. The group begins with two EC2 instances and can scale up to four.'
    },
    automation: {
      title: 'Configuration with Ansible', icon: '⚙',
      text: 'Ansible uses AWS dynamic inventory to discover EC2 servers tagged for this project. It installs and starts Apache, copies the website HTML, CSS and JavaScript, and verifies an HTTP response on each server.'
    },
    security: {
      title: 'Layered network security', icon: '♢',
      text: 'The load balancer receives public HTTP requests. EC2 servers accept HTTP only from the load balancer security group. Administrator SSH is permitted only if a specific trusted /32 IP address is configured. Add HTTPS before using this beyond a demonstration.'
    },
    deployment: {
      title: 'Repeatable deployments', icon: '▱',
      text: 'With a single Ansible playbook, you can re-deploy an improved website across the existing EC2 servers. For long-term high availability, replacement instances must also be configured automatically using a baked AMI or a launch-time management workflow.'
    }
  };
  document.querySelectorAll('[data-detail]').forEach(card => card.addEventListener('click', () => {
    const item = details[card.dataset.detail];
    if (!item) return;
    document.getElementById('detail-heading').textContent = item.title;
    document.getElementById('detail-icon').textContent = item.icon;
    document.getElementById('detail-content').textContent = item.text;
    document.getElementById('detail-dialog').showModal();
  }));
  const testButton = document.getElementById('run-health-check');
  if (testButton) testButton.addEventListener('click', async () => {
    const indicator = document.getElementById('status-light');
    const label = document.getElementById('status-label');
    const detail = document.getElementById('status-detail');
    indicator.className = 'status-indicator working';
    label.textContent = 'Checking web server…';
    detail.textContent = 'Requesting /healthz from this website';
    testButton.disabled = true;
    const start = performance.now();
    try {
      const response = await fetch('/healthz?check=' + Date.now(), { cache: 'no-store' });
      const body = (await response.text()).trim();
      if (!response.ok || body !== 'ok') throw new Error('Unexpected response (HTTP ' + response.status + ')');
      const ms = Math.round(performance.now() - start);
      indicator.className = 'status-indicator good';
      label.textContent = 'Website is responding';
      detail.textContent = 'HTTP ' + response.status + ' · /healthz returned ok · ' + ms + ' ms';
    } catch (error) {
      indicator.className = 'status-indicator bad';
      label.textContent = 'Website health check failed';
      detail.textContent = error.message + ' — check the Apache site deployment.';
    } finally {
      testButton.disabled = false;
    }
  });
})();