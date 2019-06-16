const { series } = require('gulp');
const findInFiles = require('find-in-files');
const fs = require('fs');

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

function generateACFKey() {
    var characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var key = '';
    var max = characters.length - 1;
    for ( var i = 0; i < 13; i++ ) {
        key += characters[Math.floor(Math.random() * Math.floor(max))];
    }
    return key;
}

function recursiveAddKeysToSubFields(subFieldsArray) {
    for ( var i = 0; i < subFieldsArray.length; i++ ) {
        subFieldsArray[i].key = 'field_' + generateACFKey();

        if ( typeof subFieldsArray[i].sub_fields !== 'undefined' ) {
            subFieldsArray[i].sub_fields = recursiveAddKeysToSubFields(subFieldsArray[i].sub_fields);
        }
    }

    return subFieldsArray;
}

module.exports.createMeta = function ( excludes ) {
    var acfMetaArray = {};
    findInFiles.find( { 'term': 'acf_meta', 'flags': 'ig' }, '.', '.php$' )
        .then( function( files ) {
            var newGroupFlag = '';
            var newFileFlag = '';
            var groupCounter = 0;

            for ( var file in files ) {
                var fileSlug = slugify(file);

                if ( ! excludes.includes(file) ) {
                    var contents = fs.readFileSync(file, 'utf8');
                    var rows = contents.match(/acf_meta(.*);/gi);

                    for ( var i = 0; i < rows.length; i++ ) {
                        try {
                            var explodeString = rows[i].replace(/acf_meta\('/gi, '').replace(/'\);/gi, '');
                            var stringArray = explodeString.split('\', \'', 4);

                            // create variables
                            var fieldType = stringArray[0];
                            var fieldName = stringArray[1];
                            var fieldSlug = slugify(fieldName);
                            var fieldGroup = stringArray[2];
                            var fieldGroupSlug = slugify(fieldGroup);
                            var fieldExtras = '';
                            if ( typeof stringArray[3] !== 'undefined' ) {
                                fieldExtras = JSON.parse(stringArray[3]);
                            }

                            var fieldGroupUnique = fieldGroupSlug + '_' + fileSlug;

                            // Check if we are on a new page or new group.
                            if ( newFileFlag !== fileSlug || newGroupFlag !== fieldGroupUnique ) {
                                // Check for new file to reset group counter
                                if ( newFileFlag !== fileSlug ) {
                                    groupCounter = 0;
                                }

                                // Group counter increase
                                groupCounter++;

                                var fieldKey = generateACFKey();
                                var fieldGroupKey = generateACFKey();

                                acfMetaArray[fieldGroupUnique] = {
                                    'key': 'group_' + fieldGroupKey,
                                    'title': fieldGroup,
                                    'menu_order': groupCounter,
                                    'fields': [
                                        {
                                            'key': 'field_' + fieldKey,
                                            'label': fieldName,
                                            'name': fieldSlug,
                                            'type': fieldType,
                                            'parent': 'group_' + fieldGroupKey
                                        }
                                    ],
                                };

                                // Merge the field extras with the main field options
                                if ( fieldExtras !== '' ) {
                                    for ( var key of Object.keys(fieldExtras) ) {
                                        // check for sub fields and generate key for each sub field
                                        if ( key === 'sub_fields' ) {
                                            recursiveAddKeysToSubFields(fieldExtras.sub_fields);
                                        }

                                        acfMetaArray[fieldGroupUnique]['fields'][0][key] = fieldExtras[key];
                                    }
                                }

                                // Setup location field
                                // Check if it's a page!
                                if ( file.indexOf('page') !== -1 ) {
                                    if ( file == 'page.php' ) {
                                        acfMetaArray[fieldGroupUnique]['location'] = [
                                            [
                                                {
                                                    'param': 'page_template',
                                                    'operator': '==',
                                                    'value': 'default'
                                                }
                                            ]
                                        ];
                                    }
                                    else {
                                        acfMetaArray[fieldGroupUnique]['location'] = [
                                            [
                                                {
                                                    'param': 'page_template',
                                                    'operator': '==',
                                                    'value': file
                                                }
                                            ]
                                        ];
                                    }
                                }
                                // Check if it's a post type template!
                                else if ( file.indexOf('post-template') !== -1 ) {
                                    acfMetaArray[fieldGroupUnique]['location'] = [
                                        [
                                            {
                                                'param': 'post_template',
                                                'operator': '==',
                                                'value': file
                                            }
                                        ]
                                    ];
                                }
                                // check if we are on a views.php file (post type view)
                                else if ( file.indexOf('views.php') !== -1 ) {
                                    // need to get the folder and then the post type file to get the name
                                    // "file" variable gives us the path to the file relative to the theme root
                                    // fileArr[1] = folder = post type
                                    var fileArr = file.split('/');
                                    
                                    // set post type location
                                    acfMetaArray[fieldGroupUnique]['location'] = [
                                        [
                                            {
                                                'param': 'post_type',
                                                'operator': '==',
                                                'value': fileArr[1]
                                            }
                                        ]
                                    ];
                                }
                                // All other checks in our instance should be post types
                                else {
                                    // get the post type
                                    var postType = '';
                                    if ( file.indexOf('single') !== -1 || file.indexOf('archive') !== -1 ) {
                                        if ( file.indexOf('single.php') !== -1 ) {
                                            postType = 'post';
                                        }
                                        else if ( file.indexOf('archive.php') !== -1 ) {
                                            postType = 'post';
                                        }
                                        else {
                                            postType = file.replace(/(archive-|single-|.php)/gi, '');
                                        }
                                    }

                                    // set post type location
                                    acfMetaArray[fieldGroupUnique]['location'] = [
                                        [
                                            {
                                                'param': 'post_type',
                                                'operator': '==',
                                                'value': postType
                                            }
                                        ]
                                    ];
                                }
                            }
                            else {
                                // Generate a new field ACF key
                                // We only generate a new field key here as we aren't generating a new group
                                var fieldKey = generateACFKey();

                                // Add field to existing array.
                                acfMetaArray[fieldGroupUnique]['fields'].push({
                                    'key': 'field_' + fieldKey,
                                    'label': fieldName,
                                    'name': fieldSlug,
                                    'type': fieldType,
                                    'parent': 'group_' + fieldGroupKey
                                });
                                
                                // Merge the field extras with the main field options
                                if ( fieldExtras !== '' )
                                {
                                    for ( var key of Object.keys(fieldExtras) ) {
                                        // check for sub fields and generate key for each sub field
                                        if ( key === 'sub_fields' ) {
                                            recursiveAddKeysToSubFields(fieldExtras.sub_fields);
                                        }
                                        
                                        acfMetaArray[fieldGroupUnique]['fields'][acfMetaArray[fieldGroupUnique]['fields'].length - 1][key] = fieldExtras[key];
                                    }
                                }
                            }

                            // Set flag to check for a new group
                            newGroupFlag = fieldGroupUnique;

                            // Set flag to check for a new page
                            newFileFlag = fileSlug;
                        }
                        catch ( err ) {
                            return console.log('An error occured while running the meta builder: ' + err);
                        }
                    }
                }
            }

            // write to file
            fs.writeFile('acf-json/acf-meta.json', JSON.stringify(acfMetaArray), 'utf8', function(err) {
                if ( err ) {
                    return console.log('An error occured while writing JSON Object to File: ' + err);
                }

                return console.log('Wrote meta to file (acf-json/acf-meta.json).');
            });
        });
}