@echo off
title TR Capital - Push to GitHub Utility
echo ===================================================
echo TR Capital - Push to GitHub Utility
echo ===================================================
echo.
echo This script will securely initialize your local Git repository and 
echo upload it to your private GitHub account.
echo.
set /p REPO_URL="Please paste your private GitHub repository URL: "
if "%REPO_URL%"=="" (
    echo.
    echo [ERROR] Repository URL cannot be empty.
    pause
    exit /b
)

echo.
echo Checking if Git is installed...
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Git is not installed or not found in your system's PATH.
    echo Please install Git from: https://git-scm.com
    echo After installing, restart your Command Prompt and run this script again.
    echo.
    pause
    exit /b
)

echo.
echo Checking Git identity...
git config user.email >nul 2>&1
if %errorlevel% neq 0 (
    echo Git needs to set up your identity before making the first commit.
    echo.
    set /p GIT_EMAIL="Please enter your GitHub email: "
    set /p GIT_NAME="Please enter your name: "
    git config --global user.email "%GIT_EMAIL%"
    git config --global user.name "%GIT_NAME%"
    echo Identity configured successfully!
    echo.
)

echo.
echo [1/4] Initializing local Git repository...
if not exist .git (
    git init
)

echo [2/4] Adding and committing files...
git add .
git commit -m "Upload TR Capital Web App"

echo [3/4] Setting remote repository origin...
git branch -M main
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%

echo.
echo [4/4] Pushing code to GitHub...
echo (GitHub will open a secure window in your browser asking you to click "Sign In")
echo.
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ===================================================
    echo SUCCESS: Your web app is successfully uploaded to GitHub!
    echo ===================================================
) else (
    echo.
    echo [ERROR] Failed to upload. Please check your GitHub URL and try again.
)
echo.
pause
