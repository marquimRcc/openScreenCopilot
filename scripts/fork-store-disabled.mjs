console.error(
	"Microsoft Store packaging is disabled for openScreenCopilot test builds. " +
		"Configure and audit a publisher owned by this project before enabling it.",
);
process.exitCode = 1;
