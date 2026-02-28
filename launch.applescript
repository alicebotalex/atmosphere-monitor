-- Atmosphere Monitor Launcher
-- Opens the local monitor and POTO lighting documentation

on run
	-- Get the default browser
	set browserURL1 to "http://localhost:3000"
	set browserURL2 to "https://afogel.com/potodoc"
	
	-- Open both URLs in default browser
	tell application "System Events"
		open location browserURL1
		delay 0.5
		open location browserURL2
	end tell
	
	-- Bring browser to front
	delay 1
	tell application "System Events"
		set frontApp to name of first application process whose frontmost is true
		if frontApp contains "Safari" or frontApp contains "Chrome" or frontApp contains "Firefox" or frontApp contains "Brave" then
			tell application frontApp to activate
		end if
	end tell
	
	return "Launched Atmosphere Monitor and POTO Doc"
end run
