---
layout: post
title: "Shrink WSL2 and Docker Virtual Disks to Reclaim Disk Space"
date: 2025-01-07 12:00:00 -0500
description: "Complete guide to reclaim disk space by optimizing WSL2 and Docker VHDX files. Learn how to manually shrink virtual disks and improve storage efficiency."
tags: [wsl2, docker, windows, virtualization, disk-management]
categories: [tutorials, system-administration]
featured: false
last_updated: 2026-10-29
github: https://gist.github.com/davidquicast/563c7a92af8da9d911b4f358858d8504
image: /assets/img/editorial/shrink-wsl2-docker-virtual-disks-1440.webp
thumbnail: /assets/img/editorial/shrink-wsl2-docker-virtual-disks-480.webp
cover_alt: "A compressed accordion file leaves a large empty space, illustrating reclaimed virtual disk storage."
---

Deleting Linux files or Docker resources can leave the Windows VHDX file larger than the live data inside it. Manual compaction can reclaim eligible space, but the result depends on the disk and its configuration.

**Check your Docker Desktop version and storage backend first.** Docker Desktop 4.34 introduced automatic reclamation for its managed WSL 2 disk; legacy installations using `docker-desktop-data` may require different handling. The manual workflow below is not a required maintenance step for every installation. See [Docker's storage architecture and reclamation explanation](https://www.docker.com/blog/docker-desktop-4-34/).

## Understanding the Problem

WSL 2 stores a distribution's filesystem in an `ext4.vhdx` file. Free space reported inside Linux and the physical size of that file on Windows are different measurements. [Microsoft's WSL disk-space guide](https://learn.microsoft.com/en-us/windows/wsl/disk-space) explains how to locate the actual disk and inspect its capacity.

Compaction can reduce a dynamically expanding disk's physical file size. It does not guarantee a particular saving or faster workloads. [Microsoft documents that `Optimize-VHD` can complete without reducing the file size](https://learn.microsoft.com/en-us/powershell/module/hyper-v/optimize-vhd?view=windowsserver2025-ps).

## Shrinking WSL2 Virtual Disks

### Step 1: Locate the VHDX File

Store-installed distributions may use the following location. Imported or relocated distributions can be elsewhere; confirm the actual path with [Microsoft's VHD-location procedure](https://learn.microsoft.com/en-us/windows/wsl/disk-space#how-to-locate-the-vhdx-file-and-disk-path-for-your-linux-distribution) before using a compaction command:

```
C:\Users\[username]\AppData\Local\Packages\
```

Look for the vendor name corresponding to your installed distribution:

| Distribution | Vendor Folder                      |
| ------------ | ---------------------------------- |
| **Ubuntu**   | `CanonicalGroupLimited.Ubuntu*`    |
| **Debian**   | `TheDebianProject.DebianGNULinux*` |
| **Pengwin**  | `WhitewaterFoundryLtd.Co.Pengwin*` |
| **openSUSE** | `46932SUSE.openSUSE*`              |

Once you identify the correct folder, navigate to the `LocalState` subdirectory, where you will find the `ext4.vhdx` file for the distribution.

### Step 2: Prepare for Optimization

Before optimizing the VHDX file, ensure you:

1. **Save your work** and close all WSL2 sessions
2. **Stop all running containers** if using Docker
3. **Back up important distribution data** before disk maintenance

### Step 3: Optimize the Virtual Disk

1. **Shut down WSL2 completely:**

   ```powershell
   wsl --shutdown
   ```

2. **Open PowerShell as Administrator** and run the optimization command:

   ```powershell
   optimize-vhd -Path "C:\Users\[username]\AppData\Local\Packages\[vendor-folder]\LocalState\ext4.vhdx" -Mode full
   ```

   This command requires the Hyper-V PowerShell module. The disk must be detached or attached read-only. For VHDX, Microsoft notes that `Full` falls back to `Prezeroed` when the disk was not attached read-only. Do not assume every free filesystem block is reclaimable.

   **Example for Ubuntu:**

   ```powershell
   optimize-vhd -Path "C:\Users\johndoe\AppData\Local\Packages\CanonicalGroupLimited.Ubuntu22.04LTS_79rhkp1fndgsc\LocalState\ext4.vhdx" -Mode full
   ```

## Shrinking Docker Virtual Disks

### Step 1: Locate Docker's Virtual Disks

Docker's documented default WSL 2 data disk is:

```text
%LOCALAPPDATA%\Docker\wsl\disk\docker_data.vhdx
```

A legacy installation may instead use `wsl\data\ext4.vhdx`. Custom disk-image locations and other backends differ. Confirm the backend and configured disk-image location in Docker Desktop rather than assuming two disks exist. See [Docker's backup and storage-location documentation](https://docs.docker.com/desktop/settings-and-maintenance/backup-and-restore/).

### Step 2: Clean Docker Resources (Optional)

First inspect what Docker stores with `docker system df`. Cleanup is optional and separate from compaction.

The prune commands below delete resources. In particular, `docker system prune -a --volumes` removes stopped containers, unused images, build cache and unused anonymous volumes. Those volumes can contain application data even when no container uses them. Back up data you intend to retain and review Docker's confirmation prompt before pruning. See [the documented prune scope](https://docs.docker.com/reference/cli/docker/system/prune/).

```bash
# Destructive cleanup: review the confirmation prompt and retain required data
docker system prune -a --volumes

# Remove specific items
docker container prune  # Remove stopped containers
docker image prune -a   # Remove unused images
docker volume prune     # Remove unused volumes
```

### Step 3: Optimize Docker Virtual Disks

1. **Quit Docker Desktop, then shut down WSL:**

   ```powershell
   wsl --shutdown
   ```

2. **Confirm Docker Desktop is stopped** and the target disk is detached

3. **Open PowerShell as Administrator** and compact only the disk whose path you verified. These are alternative layout examples, not two commands every installation needs:

   ```powershell
   # Example for a legacy data disk, only if this is your confirmed path
   optimize-vhd -Path "C:\Users\[YOURNAME]\AppData\Local\Docker\wsl\data\ext4.vhdx" -Mode full

   # Alternative example for the managed WSL 2 data disk
   optimize-vhd -Path "C:\Users\[YOURNAME]\AppData\Local\Docker\wsl\disk\docker_data.vhdx" -Mode full
   ```

## Advanced Tips and Troubleshooting

### Monitoring Disk Usage

Before and after optimization, check the actual file sizes:

```powershell
# Check VHDX file size
Get-ChildItem "C:\Users\[username]\AppData\Local\Packages\*\LocalState\*.vhdx" |
    Select-Object Name, @{Name="Size(GB)";Expression={[math]::Round($_.Length/1GB,2)}}
```

### Alternative: Using diskpart

If the Hyper-V cmdlet is unavailable, DiskPart also supports compaction of dynamically expanding disks. The selected disk must be detached or attached read-only. See [Microsoft's `compact vdisk` reference](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/compact-vdisk).

```cmd
diskpart
select vdisk file="C:\path\to\your\file.vhdx"
compact vdisk
exit
```

### Preventing Future Bloat

1. **Regular cleanup:** Schedule periodic cleanup of unused Docker resources
2. **Use .dockerignore:** Prevent unnecessary files from being included in images
3. **Multi-stage builds:** Use Docker multi-stage builds to reduce final image size
4. **WSL2 management:** Regularly clean up packages and logs in WSL2 distributions

### Troubleshooting Common Issues

**"Access Denied" Error:**

- Ensure PowerShell is running as Administrator
- Make sure WSL2 and Docker are completely shut down
- Check if any antivirus software is locking the files

**"File is in use" Error:**

- Run `wsl --shutdown` and wait 10-15 seconds
- Close Docker Desktop completely
- Check Task Manager for any remaining `wsl.exe` or `docker` processes

**Limited Space Reclaimed:**

- Some VHDX files have minimum size limits
- Recent file writes may prevent significant shrinking
- Consider the VHDX file's allocation unit size

## Performance Impact and Results

Compare the same VHDX file before and after compaction. The PowerShell example above reports file length; for a sparse or compressed file, also inspect Windows' Size on disk when measuring reclaimed host storage. The reclaimed space can be substantial, small, or zero. No universal percentage follows from this procedure.

Measure workloads separately before attributing a performance change to disk compaction.

## Conclusion

Use compaction when your confirmed disk layout needs it, after backing up data and stopping the software that holds the disk open. Keep routine Docker cleanup separate: deleting an unused volume and reclaiming unused VHDX blocks are different operations.

Documentation checked on October 29, 2026.

---

**📝 Original Gist:** This tutorial is based on my [original GitHub Gist](https://gist.github.com/davidquicast/563c7a92af8da9d911b4f358858d8504) with expanded content and additional troubleshooting tips.

**Pro Tip:** Consider creating a PowerShell script to automate this process for multiple VHDX files, making regular maintenance even easier!
