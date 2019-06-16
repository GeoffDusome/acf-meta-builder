# @geoffdusome/acf-meta-builder

[![GitHub stars](https://img.shields.io/github/stars/GeoffDusome/acf-meta-builder.svg)](https://github.com/GeoffDusome/acf-meta-builder/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/GeoffDusome/acf-meta-builder.svg)](https://github.com/GeoffDusome/acf-meta-builder/issues)
[![GitHub license](https://img.shields.io/github/license/GeoffDusome/acf-meta-builder.svg)](https://github.com/GeoffDusome/acf-meta-builder/blob/master/LICENSE)

A package that contains a gulp task to create ACF json files by reading your project files and parsing out specific function calls.

## Installation

In order to use this gulp task, please include `@geoffdusome/acf-meta-builder` as a dependency in your package.json file. Otherwise, the package can be installed by running `npm i @geoffdusome/acf-meta-builder` on your command line.

## Usage

1. Require the package: `const metaBuilder = require('@geoffdusome/acf-meta-builder');`  
2. Create the task:  
```
gulp.task('buildMeta', function( done ) {
	metaBuilder.createMeta(['functions.php', 'header.php', 'footer.php'])
		.then(function(result) {
			console.log(result);
			done();
		}, function(err) {
			console.log(err);
			done();
		});
});
```  
3. Watch files for changes: `gulp.watch(['*.php'], gulp.series('buildMeta'));`  

## `createMeta( excludes )`

The createMeta task will look for PHP function calls containing `acfmb` as the function name. `acfmb` accepts 4 total parameters, with the first 3 being required and the last optional (please see function call below for more information). The task will loop through all files that contain a mention of the `acfmb` function, and then parses out all instances of the `acfmb` function separately to create a JSON array, which is then written to a JSON file.

Please note that the "location" of the meta is based off of the file name. I have set conventions for file names that allow me to point the meta to the right place, so if these conventions are not followed, you will have issues.

`page.php`: `page_template` = `default`  
`page-home.php`: `page_template` = `page-home.php`  
`post-template-blog-layout.php`: `post_template` = `post-template-blog-layout.php`  
`{post-type}/views.php`: `post_type` = `{post-type}`  
`single.php`: `post_type` = `post`  
`archive.php`: `post_type` = `post`  
`single-{post-type}.php`: `post_type` = `{post-type}`  
`archive-{post-type}.php`: `post_type` = `{post-type}`  

The builder does respect multi-level meta, it just involved a more complex function call, please see below.

## `acfmb('[meta type]', '[meta field name]', '[meta field group]', '[extra fields]');`

The `acfmb` function has the follow parameters:  
- meta type: The type of meta (works with all ACF meta types, found [here](https://www.advancedcustomfields.com/resources/#field-types))
- meta field name: The name of the field (ie. "Hero Headline"). The field name will be automatically slugified for use in ACF.
- meta field ground: The goup of the field (ie. "Hero"). The group name will be automatically slugified for use in ACF.
- [optional] extra fields: A JSON string containing the extra options you want to use for the field (ie. `'{"placeholder", "Hero Headline Text", "maxlength": "50"}'`). You can find more information regarding the options available [here](https://www.advancedcustomfields.com/resources/register-fields-via-php/).

### Simple Example

```
<?php acfmb('text', 'Hero Headline', 'Hero'); ?>
```

### Complex Example

With the builder, there is never any need to create a key for your fields, all keys are generated on every save. This does mean that the keys change with every save. Which usually means that you must manually pull repeater meta from `get_post_meta`. You can continually nest repeaters and etc with as many options as you want with this method. 

```
<?php acfmb('repeater', 'Years', 'Calendar', '{"layout": "block", "sub_fields": [{"type": "text", "name": "year", "label": "Year"}, {"type": "repeater", "name": "months", "label": "Months", "layout": "block", "sub_fields": [{"type": "text", "name": "month", "label": "Month"}]}]}'); ?>
```