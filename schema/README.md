# Schema

Tool calling schemas for the `apply_patch` function across different LLM providers.

## Files

| File                               | Provider  | Format                                                  |
| ---------------------------------- | --------- | ------------------------------------------------------- |
| [`openai.json`](openai.json)       | OpenAI    | `{ type, function: { name, description, parameters } }` |
| [`anthropic.json`](anthropic.json) | Anthropic | `{ name, description, input_schema }`                   |

## Parameters

| Parameter | Type                                         | Required | Description                                                              |
| --------- | -------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| `path`    | `string`                                     | Yes      | Absolute path to the file                                                |
| `diff`    | `string`                                     | Yes      | V4A diff with `@@` anchors and `space/+/-` prefixed lines                |
| `mode`    | `"update" \| "create" \| "delete" \| "move"` | Yes      | `update` modifies, `create` writes new, `delete` removes, `move` renames |

## Notes

Tested on non-GPT models and works well with this schema.
