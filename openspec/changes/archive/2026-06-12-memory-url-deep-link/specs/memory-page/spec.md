## ADDED Requirements

### Requirement: Memory selection is restored from URL query parameters

The Memory page SHALL accept URL query parameters project (the project hash used by memory commands) and file (URI-encoded memory filename). On entry, when the project parameter matches a loaded project with memory, the page SHALL select that project and load its memory files; when the file parameter additionally matches a file in that project, the page SHALL open the editor for it. Parameters that match nothing SHALL be silently ignored, leaving the page in its default unselected state.

#### Scenario: Deep link restores project and file

- **WHEN** the user opens /memory?project=<hash>&file=<name> and both parameters match existing data
- **THEN** the matching project is selected, its memory files are listed, and the editor opens on the named file

#### Scenario: Invalid parameters are ignored

- **WHEN** the user opens /memory with a project hash or filename that matches nothing
- **THEN** the page renders its default unselected state without an error

### Requirement: Memory selection changes are reflected in the URL

The Memory page SHALL update the URL query parameters as the user changes selection: selecting a project sets project and clears file; opening a memory file sets file; closing the editor clears file; switching to another project clears file. The search query and unsaved editor content SHALL NOT be written to the URL.

#### Scenario: Selecting a project updates the URL

- **WHEN** the user selects a project in the sidebar
- **THEN** the URL contains that project's hash as the project parameter and no file parameter

#### Scenario: Opening and closing a file updates the URL

- **WHEN** the user opens a memory file and later closes the editor
- **THEN** the URL gains the file parameter on open and loses it on close, while the project parameter is preserved
