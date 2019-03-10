/** ��ȡ H1~H6 ����Ԫ�� */
function getHeadlineTags() {
    var arrays = [];
    $("*[id]").each(function(){
        var tagName = $(this).prop("tagName");
        if ($.inArray(tagName, hs) >= 0) {
            // console.log(tagName)
            arrays.push($(this));
        }
    });
    return arrays;
}

/** �ж�Ԫ�ر���ȼ�H1~H6������0~5���������H1~H6���򷵻�-1 */
function getHeadlineLevel(h) {
    var tagName = $(h).prop("tagName");
    return $.inArray(tagName, hs);
}

/** ����Ŀ¼�б� */
function generateContentList(array) {
    if (array.length > 1) {
        var dom =  '<ul class="post_nav">'
        for (var i = 0; i < array.length; i++) {
            var $h1 = $(array[i]);
            var level = getHeadlineLevel( $h1 );
            var li_style = level <= 0 ? '': ' style="margin-left:'+(level*12)+'px"';
            dom += '<li'+li_style+'><a style="color:#999" href="#'+ $h1.attr("id") +'">'+ $h1.text() +'</a></li>';
        }
        dom += '</ul> ';

        // ����root [Published, Tags]
        var $sideBar = $("ul.tag_box").parent();

        // append dom
        $sideBar.append('<h4>Content List</h4>');
        $sideBar.append(dom);
    }
}

// H1~H6 ��ǩ������
var hs = ["H1", "H2", "H3", "H4", "H5", "H6"];
// �ҵ����� H1~H6 
var array = getHeadlineTags();
// ���� Content List
generateContentList(array);