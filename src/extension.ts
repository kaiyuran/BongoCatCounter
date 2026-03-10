import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const statusTextArray = [`$(bg-leftup)$(bg-rightup)`, `$(bg-leftdown)$(bg-rightup)`, `$(bg-leftup)$(bg-rightdown)`];
  let currentIndex = 0;
  let leftWasLastDown = false;
  let timeout: NodeJS.Timeout | undefined;
  let statusBarVisible = true;

  // Load counters from extension storage
  let workspaceCounter = context.workspaceState.get<number>('workspaceCounter', 0);
  let globalCounter = context.globalState.get<number>('globalCounter', 0);

  const persistCounters = async () => {
    await context.workspaceState.update('workspaceCounter', workspaceCounter);
    await context.globalState.update('globalCounter', globalCounter);
  };

  let showWorkspace = true; // toggle between workspace/global display
  const swapInterval = 3000; // 3 seconds

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
  statusBarItem.text = `${statusTextArray[currentIndex]} ${showWorkspace ? `W:${workspaceCounter}` : `G:${globalCounter}`}`;
  statusBarItem.show();

  // Swap workspace/global display every 3 seconds
  const interval = setInterval(() => {
    showWorkspace = !showWorkspace;
    statusBarItem.text = `${statusTextArray[currentIndex]} ${showWorkspace ? `W:${workspaceCounter}` : `G:${globalCounter}`}`;
  }, swapInterval);

  const onType = vscode.commands.registerCommand('type', async (args: { text: string }) => {
    currentIndex = leftWasLastDown ? 2 : 1;
    workspaceCounter++;
    globalCounter++;
    void persistCounters();
    leftWasLastDown = !leftWasLastDown;

    statusBarItem.text = `${statusTextArray[currentIndex]} ${showWorkspace ? `W:${workspaceCounter}` : `G:${globalCounter}`}`;

    if (timeout) clearTimeout(timeout);

    // Reset to default animation after 0.5s of no typing
    timeout = setTimeout(() => {
      currentIndex = 0;
      statusBarItem.text = `${statusTextArray[currentIndex]} ${showWorkspace ? `W:${workspaceCounter}` : `G:${globalCounter}`}`;
    }, 500);

    await vscode.commands.executeCommand('default:type', args);
  });

  // Toggle status bar visibility
  const toggleStatusBarCommand = vscode.commands.registerCommand('extension.toggleStatusBar', () => {
    statusBarVisible = !statusBarVisible;
    if (statusBarVisible) {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  });

  // Reset counters (workspace, global, or both)
  const resetCounterCommand = vscode.commands.registerCommand('extension.resetCounter', async () => {
    const choice = await vscode.window.showQuickPick(
      ['Reset Workspace Counter', 'Reset Global Counter', 'Reset Both'],
      { placeHolder: 'Which counter do you want to reset?' }
    );

    if (choice === 'Reset Workspace Counter' || choice === 'Reset Both') workspaceCounter = 0;
    if (choice === 'Reset Global Counter' || choice === 'Reset Both') globalCounter = 0;
    void persistCounters();

    statusBarItem.text = `${statusTextArray[currentIndex]} ${showWorkspace ? `W:${workspaceCounter}` : `G:${globalCounter}`}`;
  });

  context.subscriptions.push(onType, toggleStatusBarCommand, resetCounterCommand);
  context.subscriptions.push({ dispose: () => clearInterval(interval) });
}